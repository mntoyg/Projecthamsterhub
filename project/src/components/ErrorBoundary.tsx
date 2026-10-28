import { Component, type ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-charcoal-900 text-slate-200">
        <p className="font-mono text-lg text-red-400">SYSTEM FAULT · ระบบพบข้อผิดพลาด</p>
        <button
          onClick={() => this.setState({ failed: false })}
          className="rounded-lg bg-kmitl-orange px-4 py-2 font-mono text-sm font-bold text-white"
        >
          RECOVER
        </button>
      </div>
    );
  }
}
