import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  handleReset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="result" role="alert">
          <h2>Something went wrong</h2>
          <p className="error">{this.state.error?.message || 'Unexpected error'}</p>
          <p className="meta">You can try again without reloading the page.</p>
          <button type="button" className="btn btn-primary" onClick={this.handleReset}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
