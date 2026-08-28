# 后续事项

## R2 上线

- 创建私有 R2 bucket，并生成仅限该 bucket 对象读写的凭据。
- 在 ESA 分享函数配置 `R2_ACCOUNT_ID`、`R2_BUCKET_NAME`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`，不要提交真实值。
- 部署 `edge-functions/share_service.js`，确认 `/api/share` 与 `/share/*` 路由指向该函数。

## 线上验证

- 验证创建、更新、刷新读取和取消分享。
- 验证 SEO 页面与 `.svg` 链接。
- 验证错误编辑密钥无法覆盖或删除分享。
- 确认更新后不会读取旧快照。

## 验证通过后

- 在 ESA 删除旧认证、云文件同步函数及其路由和密钥。
- 停用不再使用的 EdgeKV namespace。
- 在 `web-z11g` 删除 `/api/esa-store`、相关测试与持久化目录配置。
- 保留一份旧数据备份，观察稳定后再清理线上数据和资源。
