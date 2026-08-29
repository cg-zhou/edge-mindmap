import { randomBytes } from 'node:crypto'

const baseUrl = process.argv[2]?.replace(/\/$/, '')
if (!baseUrl || !/^https:\/\//i.test(baseUrl)) {
  console.error('用法: yarn smoke:share-service https://你的思维导图域名')
  process.exit(1)
}

const shareId = randomBytes(16).toString('hex')
const shareToken = randomBytes(32).toString('hex')
const wrongToken = randomBytes(32).toString('hex')
const shareUrl = `${baseUrl}/share/${shareId}`
let created = false

async function expectStatus(response, expected, step) {
  if (response.status !== expected) {
    throw new Error(`${step}失败：期望 HTTP ${expected}，实际 ${response.status}；${await response.text()}`)
  }
  console.log(`✓ ${step}`)
  return response
}

function payload(title) {
  return {
    id: shareId,
    token: shareToken,
    title,
    json: { root: { data: { text: title }, children: [] } },
    svg: `<svg xmlns="http://www.w3.org/2000/svg"><text>${title}</text></svg>`
  }
}

async function writeShare(title, token = shareToken) {
  return fetch(`${baseUrl}/api/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload(title), token })
  })
}

try {
  await expectStatus(await writeShare('冒烟测试-初始'), 200, '创建分享')
  created = true
  await expectStatus(await writeShare('冒烟测试-更新'), 200, '更新分享')
  await expectStatus(await writeShare('不应写入', wrongToken), 403, '拒绝错误密钥覆盖')

  const page = await expectStatus(await fetch(shareUrl), 200, '读取图形分享页')
  if (!(await page.text()).includes('冒烟测试-更新')) throw new Error('图形分享页仍是旧快照')

  const seo = await expectStatus(await fetch(`${shareUrl}?view=seo`), 200, '读取 SEO 页面')
  if (!(await seo.text()).includes('冒烟测试-更新')) throw new Error('SEO 页面仍是旧快照')

  const svg = await expectStatus(await fetch(`${shareUrl}.svg`), 200, '读取 SVG')
  if (!(await svg.text()).includes('冒烟测试-更新')) throw new Error('SVG 仍是旧快照')
  if (!svg.headers.get('content-security-policy')?.includes('sandbox')) throw new Error('SVG 缺少沙箱 CSP')

  await expectStatus(await fetch(`${baseUrl}/api/share?id=${shareId}`, {
    method: 'DELETE', headers: { 'X-Share-Token': wrongToken }
  }), 403, '拒绝错误密钥删除')
  await expectStatus(await fetch(`${baseUrl}/api/share?id=${shareId}`, {
    method: 'DELETE', headers: { 'X-Share-Token': shareToken }
  }), 200, '取消分享')
  created = false
  await expectStatus(await fetch(shareUrl), 404, '确认分享已删除')
  console.log(`\n线上分享链路验收通过：${baseUrl}`)
} finally {
  if (created) {
    await fetch(`${baseUrl}/api/share?id=${shareId}`, {
      method: 'DELETE', headers: { 'X-Share-Token': shareToken }
    }).catch(() => {})
  }
}
