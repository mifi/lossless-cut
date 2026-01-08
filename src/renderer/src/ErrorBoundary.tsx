import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { Trans } from 'react-i18next';

import { openSendReportDialog } from './reporting';


class ErrorBoundary extends Component<{ children: ReactNode }> {
  // eslint-disable-next-line react/state-in-constructor
  override state: { error: unknown };

  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: undefined };
  }

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('componentDidCatch', error, errorInfo);
  }

  override render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <h1><Trans>Something went wrong</Trans></h1>
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{error instanceof Error ? error.message : String(error)}</div>
          <p><button type="button" onClick={() => openSendReportDialog({ err: error })} style={{ padding: 10, fontSize: 20 }}><Trans>Report error</Trans></button></p>
        </div>
      );
    }

    // eslint-disable-next-line react/destructuring-assignment
    return this.props.children;
  }
}

export default ErrorBoundary;
