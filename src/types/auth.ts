/**
 * 认证相关类型定义
 */

export interface User {
  id: string // github_123 或 microsoft_456
  provider: 'github' | 'microsoft'
  login?: string
  name: string
  avatar_url: string
  email: string
  createdAt: string
  updatedAt: string
}

export interface OAuthProvider {
  provider: 'github' | 'microsoft'
  providerId: string // GitHub用户ID或Microsoft用户ID
}

export interface UserBindings {
  userId: string // 主账户ID
  bindings: OAuthProvider[] // 绑定的OAuth源
  createdAt: string
  updatedAt: string
}

export interface Token {
  userId: string
  provider: string
  issuedAt: string
  expiresAt: string
  iat: number
  exp: number
}

export interface GithubUser {
  id: number
  login: string
  name: string
  avatar_url: string
  email: string | null
}

export interface MicrosoftUser {
  id: string
  userPrincipalName: string
  displayName: string
  mail: string
}

export interface AuthResponse {
  success: boolean
  token?: string
  user?: User
  error?: string
}

export interface UserProfile {
  id: string
  provider: string
  login?: string
  name: string
  avatar_url: string
  email: string
  type?: string // 'guest' | 'github' | 'microsoft'
  createdAt: string
  updatedAt: string
}
