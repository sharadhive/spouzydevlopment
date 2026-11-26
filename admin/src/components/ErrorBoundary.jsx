import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught rendering error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: this.props.fullScreen ? '100vh' : '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FAF7F2',
          padding: '24px',
          fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        }}>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E8E0D7',
            borderRadius: '12px',
            padding: '36px 32px',
            maxWidth: '520px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 8px 30px rgba(75, 32, 48, 0.08)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#FDECEA',
              color: '#8A402F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              fontSize: '24px'
            }}>
              <i className="fa fa-exclamation-triangle"></i>
            </div>

            <h2 style={{
              fontSize: '20px',
              color: '#4B2030',
              fontWeight: '700',
              marginBottom: '10px'
            }}>
              {this.props.title || 'Console Interface Notice'}
            </h2>

            <p style={{
              fontSize: '14px',
              color: '#6E5D57',
              lineHeight: '1.6',
              marginBottom: '24px'
            }}>
              {this.props.message || 'An unexpected rendering error occurred while loading this view. Your session and data remain safe.'}
            </p>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                onClick={this.handleReset}
                className="sp-btn sp-btn-secondary"
                style={{ minWidth: '120px' }}
              >
                <i className="fa fa-refresh"></i> Try Again
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="sp-btn sp-btn-primary"
                style={{ minWidth: '140px' }}
              >
                <i className="fa fa-repeat"></i> Reload Console
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
