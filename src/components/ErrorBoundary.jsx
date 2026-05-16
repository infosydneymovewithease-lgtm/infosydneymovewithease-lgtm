import { Component } from 'react'

// 兜底渲染错误，避免整页白屏。
// 师傅端 5/16 发现按"开始/结束"50% 概率白屏 — 没 ErrorBoundary 时根因看不到，
// 加上后至少能显示"出错了点这里刷新"，并把 stack trace 打到 console 供下次截图排查。
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] caught render error:', error)
    console.error('[ErrorBoundary] component stack:', info?.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleBack = () => {
    window.history.length > 1 ? window.history.back() : (window.location.href = '/')
  }

  render() {
    if (!this.state.error) return this.props.children

    const msg = this.state.error?.message || String(this.state.error)

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 text-center">
          <div className="text-5xl mb-3">😣</div>
          <h1 className="text-lg font-bold text-gray-800 mb-2">页面出错了</h1>
          <p className="text-gray-500 text-sm mb-1">操作没有保存好，请刷新重试。</p>
          <p className="text-gray-400 text-xs mb-5">如果反复出错，请截图发给客服。</p>

          <details className="text-left mb-5">
            <summary className="text-gray-400 text-xs cursor-pointer">错误详情（截图给客服）</summary>
            <pre className="mt-2 text-xs text-red-600 bg-red-50 p-3 rounded-lg overflow-auto max-h-40 whitespace-pre-wrap break-all">
              {msg}
            </pre>
          </details>

          <div className="space-y-2">
            <button
              onClick={this.handleReload}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors"
            >
              刷新页面
            </button>
            <button
              onClick={this.handleBack}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              返回上一页
            </button>
          </div>
        </div>
      </div>
    )
  }
}
