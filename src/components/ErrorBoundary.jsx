import React from 'react'

/**
 * Reusable ErrorBoundary Class Component
 * Catches JavaScript errors anywhere in its child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the whole app.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  // Update state so the next render will show the fallback UI
  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error
    }
  }

  // Catch side effects and error logging
  componentDidCatch(error, errorInfo) {
    console.error(`[ErrorBoundary] Caught error in ${this.props.sectionName || 'section'}:`, error, errorInfo)
    this.setState({ errorInfo })
  }

  // Reset the error boundary to attempt recovering the component
  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
    if (typeof this.props.onReset === 'function') {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      const section = this.props.sectionName || 'This section'

      // Render custom fallback if provided, otherwise render the standard resilient fallback UI
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, reset: this.handleReset })
          : this.props.fallback
      }

      return (
        <div style={{
          padding: '24px',
          background: 'rgba(248, 81, 73, 0.08)',
          border: '1px solid rgba(248, 81, 73, 0.4)',
          borderRadius: 14,
          margin: '16px 0',
          backdropFilter: 'blur(10px)',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: '1.6rem' }}>💥</span>
            <div>
              <h3 style={{ fontSize: '1.05rem', color: '#ff7b72', margin: 0, fontWeight: 700 }}>
                {section} encountered an error
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
                The rest of the application is still functioning normally.
              </p>
            </div>
          </div>

          <div style={{
            background: '#090d12',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            color: '#f85149',
            margin: '12px 0 16px 0',
            wordBreak: 'break-word'
          }}>
            {this.state.error?.message || 'Unknown runtime error occurred.'}
          </div>

          <button
            onClick={this.handleReset}
            className="btn btn-secondary"
            style={{
              padding: '8px 18px',
              fontSize: '0.85rem',
              borderColor: 'rgba(248, 81, 73, 0.5)',
              color: '#f0f6fc'
            }}
          >
            ↻ Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
