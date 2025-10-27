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

// 检测是否支持ES模块
if (typeof importScripts === 'undefined') {
    // 浏览器环境
    console.log('加载非模块化入口点: index.js');
    
    // 检查浏览器兼容性
    function checkBrowserCompatibility() {
        // 检查是否支持Web Audio API
        if (!window.AudioContext && !window.webkitAudioContext) {
            alert('您的浏览器不支持Web Audio API，请使用现代浏览器如Chrome、Firefox、Safari或Edge。');
            return false;
        }
        return true;
    }

    // 初始化响应式行为
    function initResponsiveBehavior() {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // 为触摸设备添加视觉提示
        if (isTouchDevice) {
            document.body.classList.add('touch-device');
            console.log('检测到触摸设备，启用触摸优化');
            
            // 为常用功能添加更大的触摸区域
            const tapButton = document.getElementById('tap-btn');
            if (tapButton) {
                // 增加触摸区域，但保持视觉大小不变
                tapButton.style.touchAction = 'manipulation';
                tapButton.style.userSelect = 'none';
            }
            
            // 为播放按钮添加触摸优化
            const toggleButton = document.getElementById('toggle-btn');
            if (toggleButton) {
                toggleButton.style.touchAction = 'manipulation';
                toggleButton.style.userSelect = 'none';
            }
            
            // 为重置按钮添加触摸优化
            const resetButton = document.getElementById('reset-btn');
            if (resetButton) {
                resetButton.style.touchAction = 'manipulation';
                resetButton.style.userSelect = 'none';
            }
        }
        
        // 添加窗口调整大小事件处理
        window.addEventListener('resize', handleResize);
        
        // 初始化时执行一次
        handleResize();
    }

    // 窗口大小调整处理
    function handleResize() {
        const width = window.innerWidth;
        
        // 根据屏幕宽度应用不同的优化
        if (width <= 480) {
            document.body.classList.add('small-screen');
            document.body.classList.remove('medium-screen', 'large-screen');
        } else if (width <= 768) {
            document.body.classList.add('medium-screen');
            document.body.classList.remove('small-screen', 'large-screen');
        } else {
            document.body.classList.add('large-screen');
            document.body.classList.remove('small-screen', 'medium-screen');
        }
        
        console.log(`窗口大小调整为: ${width}px，应用了${document.body.classList.contains('small-screen') ? '小屏幕' : document.body.classList.contains('medium-screen') ? '中等屏幕' : '大屏幕'}样式`);
    }

    // 显示兼容性提示
    function showCompatibilityMessage() {
        const message = document.createElement('div');
        message.style.position = 'fixed';
        message.style.bottom = '20px';
        message.style.left = '50%';
        message.style.transform = 'translateX(-50%)';
        message.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        message.style.color = 'white';
        message.style.padding = '15px 25px';
        message.style.borderRadius = '5px';
        message.style.zIndex = '9999';
        message.style.fontSize = '14px';
        message.style.textAlign = 'center';
        message.style.maxWidth = '90%';
        message.textContent = '提示：使用键盘快捷键可以提升使用体验 - 空格键(播放/暂停)，E键(重置)，T键(TAP测速)';
        document.body.appendChild(message);
        
        // 5秒后自动隐藏
        setTimeout(() => {
            message.style.opacity = '0';
            message.style.transition = 'opacity 1s';
            setTimeout(() => {
                document.body.removeChild(message);
            }, 1000);
        }, 5000);
    }

    // 初始化应用
    function initApp() {
        // 检查浏览器兼容性
        if (!checkBrowserCompatibility()) {
            return;
        }
        
        // 初始化响应式行为
        initResponsiveBehavior();
        
        // 其他初始化代码将在这里
        console.log('节拍器应用初始化中...');
        
        // 延迟加载主要应用模块
        import('./main.js').catch(err => {
            console.error('加载主应用模块失败:', err);
            alert('应用加载失败，请刷新页面重试。');
        });
    }
    
    // 当页面加载完成时初始化应用
    document.addEventListener('DOMContentLoaded', () => {
        initApp();
        showCompatibilityMessage();
    });
} else {
    // Web Worker环境
    console.log('在Web Worker中加载index.js');
}
    
} catch (error) {
    console.error('加载应用时出错:', error);
    // 显示基本的错误消息
    if (window && window.alert) {
        alert('应用加载失败，请刷新页面重试。');
    }
}