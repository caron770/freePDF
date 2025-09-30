import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';

// 错误处理
window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的 Promise 拒绝:', event.reason);
  // 可以在这里添加错误上报逻辑
});

window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);
  // 可以在这里添加错误上报逻辑
});

// 渲染应用
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);