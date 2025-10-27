/**
 * 音频错误边界模块
 * 处理音频上下文失败等音频相关错误
 * 实现依赖注入和智能错误恢复
 * @module audioErrorBoundary
 */

// 依赖通过依赖注入系统提供，不再直接导入

// 延迟导入AppInitializer以避免循环依赖
let AppInitializer = null;

/**
 * 音频错误边界管理器 - 架构优化版
 * 提供音频错误检测、UI展示和恢复功能
 * 实现与依赖注入系统的集成
 * @module audioErrorBoundary
 */
export const AudioErrorBoundary = {
    // 错误状态
    hasError: false,
    errorMessage: '',
    errorType: null,
    errorContext: null,
    originalError: null,
    
    // 错误UI元素引用
    errorElement: null,
    
    // 配置选项
    _options: {},
    
    // 依赖注入容器
    _dependencies: {},
    
    // 错误类型分类
    errorTypes: {
        AUDIO_CONTEXT_FAILURE: 'audio_context_failure',
        PLAYBACK_FAILURE: 'playback_failure',
        BUFFER_LOAD_FAILURE: 'buffer_load_failure',
        PERMISSION_DENIED: 'permission_denied'
    },
    
    /**
     * 初始化错误边界
     * @param {Object} options - 初始化选项
     * @param {Object} dependencies - 依赖项（通过依赖注入提供）
     */
    async initialize(options = {}, dependencies = {}) {
        // 保存依赖项（优先使用注入的依赖）
        this._dependencies = dependencies;
        
        // 保存选项
        this._options = {
            showUI: true,
            autoRecovery: false,
            ...options
        };
        
        // 确保DOM中存在错误容器
        this._ensureErrorContainer();
        
        // 监听全局错误
        this._setupGlobalListeners();
        
        // 获取调度器实例（优先从依赖注入获取）
        const scheduler = dependencies.scheduler || window.scheduler;
        
        // 添加对音频上下文状态变化的监听
        if (scheduler && scheduler.audioContext) {
            this._monitorAudioContext(scheduler.audioContext);
        }
        
        // 尝试动态导入AppInitializer（如果还没有的话）
        if (!AppInitializer && !dependencies.AppInitializer) {
            try {
                const module = await import('./init.js');
                AppInitializer = module.AppInitializer;
                console.log('[音频错误边界] 动态导入AppInitializer成功');
            } catch (importError) {
                console.warn('[音频错误边界] 动态导入AppInitializer失败:', importError);
            }
        }
        
        console.log('[音频错误边界] 初始化完成');
    },
    
    /**
     * 初始化错误边界（兼容旧版接口）
     */
    async init() {
        // 调用新的初始化方法
        return this.initialize({}, {
            scheduler: window.scheduler,
            AppInitializer: window.AppInitializer
        });
    },
    
    /**
     * 检测错误是否与音频上下文相关
     * @param {Error} error - 错误对象
     * @returns {boolean} 是否为音频上下文错误
     */
    isAudioContextError(error) {
        return error.message && error.message.includes('AudioContext');
    },
    
    /**
     * 处理音频错误
     * @param {Error} error - 错误对象
     * @param {Object} options - 错误处理选项
     */
    catchError(error, options = {}) {
        console.error('[音频错误边界] 捕获到错误:', error);
        
        // 确定错误类型
        const errorType = this._determineErrorType(error) || this.isAudioContextError(error) ? 'audio_context_failure' : 'unknown';
        
        // 存储错误信息
        this.hasError = true;
        this.errorMessage = error.message || '未知音频错误';
        this.errorType = errorType;
        this.errorContext = options.context || '音频操作';
        this.originalError = error;
        
        // 记录错误统计
        this._logError(error, errorType, options);
        
        // 显示错误UI
        if (this._options?.showUI !== false) {
            this._showErrorUI();
        }
        
        // 如果启用了自动恢复，尝试恢复
        if (options.autoRecover || this._options?.autoRecovery) {
            this.attemptRecovery().catch(recoveryError => {
                console.error('[音频错误边界] 自动恢复失败:', recoveryError);
            });
        }
        
        return this.hasError;
    },
    
    /**
     * 重置错误状态
     */
    resetError() {
        this.hasError = false;
        this.errorMessage = '';
        this.errorType = null;
        this.errorContext = null;
        this.originalError = null;
        this._hideErrorUI();
    },
    
    /**
     * 获取当前错误状态
     * @returns {Object} 错误状态信息
     */
    getErrorStatus() {
        return {
            hasError: this.hasError,
            errorMessage: this.errorMessage,
            errorType: this.errorType,
            errorContext: this.errorContext,
            isInitialized: !!this.errorElement
        };
    },
    
    /**
     * 尝试恢复音频系统
     * @param {Object} options - 恢复选项
     * @param {boolean} options.legacyMode - 是否使用传统初始化模式
     * @returns {Promise<boolean>} 恢复是否成功
     */
    async attemptRecovery(options = {}) {
        try {
            console.log('[音频错误边界] 开始恢复音频系统...');
            
            // 获取AppInitializer（优先从依赖注入获取）
            let initializer = this._dependencies?.AppInitializer || window.AppInitializer;
            
            // 如果还没有AppInitializer，尝试动态导入
            if (!initializer && !AppInitializer) {
                try {
                    const module = await import('./init.js');
                    AppInitializer = module.AppInitializer;
                    initializer = AppInitializer;
                } catch (importError) {
                    console.warn('[音频错误边界] 动态导入AppInitializer失败:', importError);
                }
            } else if (!initializer && AppInitializer) {
                initializer = AppInitializer;
            }
            
            // 检查是否有初始化器可用
            if (!initializer) {
                throw new Error('AppInitializer不可用，无法进行恢复');
            }
            
            // 重置错误状态
            this.resetError();
            
            // 显示恢复中状态
            this._showRecoveryUI();
            
            // 使用AppInitializer的retryInitialize方法重新初始化
            if (typeof initializer.retryInitialize === 'function') {
                const recoveryResult = await initializer.retryInitialize();
                console.log('[音频错误边界] 使用retryInitialize恢复完成:', recoveryResult);
                return recoveryResult;
            } else if (typeof initializer.initialize === 'function') {
                // 降级方案
                const initOptions = options.legacyMode ? {} : { useDependencyGraph: true };
                const initResult = await initializer.initialize(initOptions);
                console.log('[音频错误边界] 使用initialize恢复完成:', initResult);
                return initResult;
            }
            
            throw new Error('AppInitializer缺少必要的初始化方法');
        } catch (error) {
            console.error('[音频错误边界] 恢复失败:', error);
            // 重新显示错误UI
            this.catchError(error, { autoRecover: false });
            return false;
        } finally {
            // 无论成功失败，隐藏恢复UI
            this._hideRecoveryUI();
        }
    },
    
    /**
     * 确保DOM中存在错误容器
     * @private
     */
    _ensureErrorContainer() {
        let container = document.getElementById('audio-error-boundary');
        if (!container) {
            container = document.createElement('div');
            container.id = 'audio-error-boundary';
            container.className = 'audio-error-boundary';
            container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                display: none;
                font-family: Arial, sans-serif;
            `;
            
            const content = document.createElement('div');
            content.className = 'audio-error-content';
            content.style.cssText = `
                background-color: white;
                padding: 30px;
                border-radius: 10px;
                text-align: center;
                max-width: 90%;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            `;
            
            const title = document.createElement('h3');
            title.textContent = '音频系统异常';
            title.style.cssText = 'color: #e74c3c; margin-bottom: 20px; font-size: 24px;';
            
            const message = document.createElement('p');
            message.id = 'audio-error-message';
            message.textContent = '音频上下文初始化失败';
            message.style.cssText = 'color: #555; margin-bottom: 25px; font-size: 16px;';
            
            const retryButton = document.createElement('button');
            retryButton.textContent = '点击重试';
            retryButton.id = 'audio-error-retry';
            retryButton.style.cssText = `
                padding: 12px 30px;
                background-color: #3498db;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 16px;
                cursor: pointer;
                transition: background-color 0.3s;
            `;
            
            retryButton.addEventListener('click', () => {
                this.attemptRecovery();
            });
            
            retryButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                retryButton.style.backgroundColor = '#2980b9';
            });
            
            retryButton.addEventListener('touchend', (e) => {
                e.preventDefault();
                retryButton.style.backgroundColor = '#3498db';
                this.attemptRecovery();
            });
            
            content.appendChild(title);
            content.appendChild(message);
            content.appendChild(retryButton);
            container.appendChild(content);
            document.body.appendChild(container);
        }
        
        this.errorElement = container;
    },
    
    /**
     * 显示错误UI
     * @private
     */
    _showErrorUI() {
        if (!this.errorElement) {
            this._ensureErrorContainer();
        }
        
        // 设置错误信息
        const messageElement = document.getElementById('audio-error-message');
        if (messageElement) {
            messageElement.textContent = this.errorMessage || '音频上下文初始化失败';
        }
        
        // 添加错误上下文和提示信息（如果UI支持）
        const contextElement = this.errorElement.querySelector('.audio-error-context');
        if (contextElement) {
            contextElement.textContent = this.errorContext;
        }
        
        const hintElement = this.errorElement.querySelector('.audio-error-hint');
        if (hintElement) {
            hintElement.textContent = this._getErrorHint(this.errorType);
        }
        
        // 显示错误UI
        this.errorElement.style.display = 'flex';
        // 阻止背景页面滚动
        document.body.style.overflow = 'hidden';
    },
    
    /**
     * 隐藏错误UI
     * @private
     */
    _hideErrorUI() {
        if (this.errorElement) {
            this.errorElement.style.display = 'none';
            // 恢复页面滚动
            document.body.style.overflow = '';
        }
    },
    
    /**
     * 显示恢复中UI
     * @private
     */
    _showRecoveryUI() {
        if (!this.errorElement) {
            this._ensureErrorContainer();
        }
        
        // 显示恢复状态
        const recoveryElement = this.errorElement.querySelector('.audio-error-recovery');
        if (recoveryElement) {
            recoveryElement.style.display = 'block';
        }
    },
    
    /**
     * 隐藏恢复中UI
     * @private
     */
    _hideRecoveryUI() {
        if (this.errorElement) {
            const recoveryElement = this.errorElement.querySelector('.audio-error-recovery');
            if (recoveryElement) {
                recoveryElement.style.display = 'none';
            }
        }
    },
    
    /**
     * 根据错误类型获取提示信息
     * @private
     * @param {string} errorType - 错误类型
     * @returns {string} 提示信息
     */
    _getErrorHint(errorType) {
        const hints = {
            audio_context_failure: '请检查浏览器是否支持Web Audio API或是否被其他标签页占用。',
            playback_failure: '播放失败，请检查音频设备设置。',
            buffer_load_failure: '音频文件加载失败，请刷新页面重试。',
            permission_denied: '音频权限被拒绝，请允许应用访问音频设备。'
        };
        
        return hints[errorType] || '请尝试刷新页面或检查音频设备。';
    },
    
    /**
     * 确定错误类型
     * @private
     * @param {Error} error - 错误对象
     * @returns {string} 错误类型
     */
    _determineErrorType(error) {
        if (!error) return null;
        
        const message = error.message || '';
        
        if (message.includes('AudioContext') || this.isAudioContextError(error)) {
            return this.errorTypes.AUDIO_CONTEXT_FAILURE;
        } else if (message.includes('playback') || message.includes('decodeAudioData')) {
            return this.errorTypes.PLAYBACK_FAILURE;
        } else if (message.includes('load') || message.includes('fetch')) {
            return this.errorTypes.BUFFER_LOAD_FAILURE;
        } else if (message.includes('permission') || message.includes('denied')) {
            return this.errorTypes.PERMISSION_DENIED;
        }
        
        return null;
    },
    
    /**
     * 记录错误日志
     * @private
     * @param {Error} error - 错误对象
     * @param {string} errorType - 错误类型
     * @param {Object} options - 记录选项
     */
    _logError(error, errorType, options = {}) {
        // 调用原来的_trackError方法
        this._trackError(errorType, {
            browser: navigator.userAgent,
            state: (this._dependencies?.scheduler || window.scheduler || scheduler) ? 
                (this._dependencies?.scheduler || window.scheduler || scheduler).getStatus() : 'unknown',
            errorInfo: options,
            originalError: error
        });
    },
    
    /**
     * 设置全局错误监听器
     * @private
     */
    _setupGlobalListeners() {
        // 监听音频错误事件（如果应用有自定义音频错误事件）
        window.addEventListener('audio:error', (event) => {
            this.catchError(event.detail || new Error('Audio error event'));
        });
        
        // 监听未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason && this.isAudioContextError(event.reason)) {
                event.preventDefault();
                this.catchError(event.reason, { source: 'unhandledrejection' });
            }
        });
    },
    
    /**
     * 监控音频上下文状态
     * @param {AudioContext} audioContext - 音频上下文
     * @private
     */
    _monitorAudioContext(audioContext) {
        const originalStatechange = audioContext.onstatechange;
        
        audioContext.onstatechange = () => {
            console.log(`音频上下文状态变化: ${audioContext.state}`);
            
            // 当状态变为'closed'时，触发错误检测
            if (audioContext.state === 'closed') {
                this.catchError(new Error('AudioContext unexpectedly closed'));
            }
            
            // 调用原始的状态变化处理函数
            if (typeof originalStatechange === 'function') {
                originalStatechange.call(audioContext);
            }
        };
    },
    
    /**
     * 跟踪错误信息
     * @param {string} errorType - 错误类型
     * @param {Object} errorData - 错误数据
     * @private
     */
    _trackError(errorType, errorData) {
        // 模拟analytics.trackError功能
        console.error(`[错误跟踪] ${errorType}:`, errorData);
        
        // 如果需要，可以添加实际的错误跟踪代码
        // 例如发送到服务器或使用第三方分析工具
    }
};

/**
 * 包装音频操作，提供错误边界保护
 * @param {Function} audioOperation - 音频操作函数
 * @returns {Promise} 操作结果Promise
 */
export function withAudioErrorBoundary(audioOperation) {
    return async function(...args) {
        try {
            return await audioOperation.apply(this, args);
        } catch (error) {
            if (AudioErrorBoundary.isAudioContextError(error)) {
                AudioErrorBoundary.catchError(error, {
                    operation: audioOperation.name || 'anonymous',
                    arguments: args.length
                });
            }
            throw error; // 重新抛出以便调用者也能处理
        }
    };
}

// 自动初始化
if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        AudioErrorBoundary.init();
    });
} else if (typeof document !== 'undefined') {
    AudioErrorBoundary.init();
}