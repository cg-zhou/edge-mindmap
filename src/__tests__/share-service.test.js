import { beforeEach, describe, expect, it, vi } from 'vitest'
import shareService from '../../edge-functions/share_service.js'

const env = {
  R2_ACCOUNT_ID: 'account-id',
  R2_BUCKET_NAME: 'mindmap-shares',
  R2_ACCESS_KEY_ID: 'access-key',
  R2_SECRET_ACCESS_KEY: 'secret-key'
}

const shareId = 'a'.repeat(32)
const shareToken = 'b'.repeat(64)

describe('R2 分享边缘函数', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('创建分享时先检查对象，再写入带签名的 R2 请求', async () => {
    const r2Fetch = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
    vi.stubGlobal('fetch', r2Fetch)

    const response = await shareService.fetch(new Request('https://mindmap.example/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://mindmap.example' },
      body: JSON.stringify({
        id: shareId,
        token: shareToken,
        title: '示例',
        json: { root: { data: { text: '示例' }, children: [] } },
        svg: '<svg></svg>'
      })
    }), env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, shareUrl: `/share/${shareId}` })
    expect(r2Fetch).toHaveBeenCalledTimes(2)
    expect(r2Fetch.mock.calls[0][0]).toContain(`/mindmap-shares/shares/${shareId}.json`)
    expect(r2Fetch.mock.calls[1][1].headers.Authorization).toContain('AWS4-HMAC-SHA256')
  })

  it('拒绝使用错误编辑密钥覆盖已有分享', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ownerTokenHash: 'different-token-hash',
      json: { root: { data: { text: '已有内容' }, children: [] } }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    const response = await shareService.fetch(new Request('https://mindmap.example/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: shareId,
        token: shareToken,
        json: { root: { data: { text: '覆盖内容' }, children: [] } }
      })
    }), env)

    expect(response.status).toBe(403)
  })

  it('SEO 页面会转义标题和节点文本', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      title: '<script>alert(1)</script>',
      json: { root: { data: { text: '<b>节点</b>' }, children: [] } },
      svg: '',
      ownerTokenHash: 'hash'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    const response = await shareService.fetch(
      new Request(`https://mindmap.example/share/${shareId}?view=seo`),
      env
    )
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&lt;b&gt;节点&lt;/b&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })
})
