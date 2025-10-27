/**
 * 节拍器应用入口文件 - 非模块化版本
 * 
 * 该文件用于不直接支持ES模块的环境，作为main.js的备用入口
 */

// 检查是否支持ES模块
if (typeof importScripts === 'undefined' && window && window.location) {
    // 在浏览器环境中，如果支持ES模块，重定向到main.js
    try {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'main.js';
        document.head.appendChild(script);
        console.log('使用模块化入口点: main.js');
        return;
    } catch (e) {
        console.warn('不支持ES模块，尝试加载非模块化入口');
    }
}

// 对于不支持ES模块的环境，这里可以实现替代方案
// 例如使用RequireJS或其他模块加载器

// 添加基本的错误处理
try {
    console.log('加载非模块化入口点: index.js');
    
    // 显示兼容性提示
    function showCompatibilityMessage() {
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            background-color: #f44336;
            color: white;
            padding: 10px;
            text-align: center;
            z-index: 1000;
            font-family: Arial, sans-serif;
        `;
        container.textContent = '您的浏览器可能不完全支持本应用的所有功能，建议使用现代浏览器如Chrome、Firefox或Safari。';
        document.body.insertBefore(container, document.body.firstChild);
        
        setTimeout(() => {
            container.style.opacity = '0';
            container.style.transition = 'opacity 0.5s';
            setTimeout(() => container.remove(), 500);
        }, 5000);
    }
    
    // 如果页面加载完成，显示兼容性提示
    if (document.readyState === 'complete') {
        showCompatibilityMessage();
    } else {
        window.addEventListener('load', showCompatibilityMessage);
    }
    
} catch (error) {
    console.error('加载应用时出错:', error);
    // 显示基本的错误消息
    if (window && window.alert) {
        alert('应用加载失败，请刷新页面重试。');
    }
}