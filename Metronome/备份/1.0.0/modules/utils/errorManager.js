/**
 * 错误处理模块
 * 
 * @module errorManager
 * @description 提供统一的错误处理机制，支持不同类型错误的分类处理
 */

// 导出必要的枚举和类型
export const ErrorType = {
    AUDIO_ERROR: 'audio_error',
    UI_ERROR: 'ui_error',
    CONFIG_ERROR: 'config_error',
    TRAINING_ERROR: 'training_error',
    STATE_ERROR: 'state_error',
    APP_ERROR: 'app_error',
    UNKNOWN_ERROR: 'unknown_error'
};

export const ErrorLevel = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

// 错误处理相关的配置和工具函数
const errorConfig = {
    // 是否在控制台输出错误详情
    logToConsole: true,
    // 是否显示用户错误消息
    showUserMessage: true,
    // 是否记录错误堆栈
    captureStackTrace: true,
    // 是否自动上报错误（可扩展为远程日志）
    autoReportErrors: false
};

/**
 * 创建错误管理器实例
 * @returns {Object} 错误管理器对象
 */
function createErrorManager() {
    const listeners = [];
    
    /**
     * 初始化全局错误处理器
     */
    function initGlobalHandlers() {
        // 处理未捕获的JavaScript错误
        window.addEventListener('error', (event) => {
            handleError({
                type: ErrorType.UNKNOWN_ERROR,
                level: ErrorLevel.CRITICAL,
                message: '未捕获的JavaScript错误',
                error: event.error,
                context: {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                }
            });
        });
        
        // 处理未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            handleError({
                type: ErrorType.UNKNOWN_ERROR,
                level: ErrorLevel.ERROR,
                message: '未处理的Promise拒绝',
                error: event.reason,
                context: { promise: event.promise }
            });
        });
    }
    
    /**
     * 创建标准错误对象
     * @param {Object} errorInfo - 错误信息
     * @returns {Object} 标准错误对象
     */
    function createStandardError(errorInfo) {
        const error = errorInfo.error || new Error(errorInfo.message);
        
        return {
            type: errorInfo.type || ErrorType.UNKNOWN_ERROR,
            level: errorInfo.level || ErrorLevel.ERROR,
            message: errorInfo.message || error.message || '未知错误',
            originalError: error,
            context: errorInfo.context || {},
            timestamp: Date.now(),
            stack: errorConfig.captureStackTrace ? error.stack : undefined
        };
    }
    
    /**
     * 根据错误级别获取对应的控制台方法
     * @param {string} level - 错误级别
     * @returns {Function} 控制台方法
     */
    function getConsoleMethod(level) {
        switch (level) {
            case ErrorLevel.INFO:
                return console.info;
            case ErrorLevel.WARNING:
                return console.warn;
            case ErrorLevel.ERROR:
            case ErrorLevel.CRITICAL:
                return console.error;
            default:
                return console.error;
        }
    }
    
    /**
     * 记录错误到控制台
     * @param {Object} standardError - 标准错误对象
     */
    function logError(standardError) {
        const { type, level, message, originalError, context } = standardError;
        
        const consoleMethod = getConsoleMethod(level);
        consoleMethod(`[${type}] ${message}`, {
            originalError,
            context
        });
    }
    
    /**
     * 通知所有错误监听器
     * @param {Object} standardError - 标准错误对象
     */
    function notifyListeners(standardError) {
        listeners.forEach((listener, index) => {
            try {
                listener(standardError);
            } catch (listenerError) {
                console.error(`错误监听器 ${index} 执行失败:`, listenerError);
            }
        });
    }
    
    /**
     * 处理错误
     * @param {Object} errorInfo - 错误信息对象
     * @returns {Object} 处理后的错误对象
     */
    function handleError(errorInfo) {
        try {
            // 创建标准错误对象
            const standardError = createStandardError(errorInfo);
            
            // 记录错误到控制台
            if (errorConfig.logToConsole) {
                logError(standardError);
            }
            
            // 通知所有错误监听器
            notifyListeners(standardError);
            
            return standardError;
        } catch (handlingError) {
            console.error('错误处理过程中发生错误:', handlingError);
            return {
                type: ErrorType.UNKNOWN_ERROR,
                level: ErrorLevel.CRITICAL,
                message: '错误处理失败',
                originalError: errorInfo
            };
        }
    }
    
    /**
     * 添加错误监听器
     * @param {Function} listener - 错误监听器函数
     * @returns {Function} 移除监听器的函数
     */
    function addListener(listener) {
        if (typeof listener !== 'function') {
            console.warn('错误监听器必须是一个函数');
            return () => {};
        }
        
        listeners.push(listener);
        
        return () => {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    }
    
    // 初始化全局错误处理器
    initGlobalHandlers();
    
    // 返回错误管理器接口
    return {
        handleError,
        addListener
    };
}

// 创建错误管理器实例
const errorManager = createErrorManager();

/**
 * 音频错误处理函数
 * @param {Error|string} error - 错误对象或消息
 * @param {Object} context - 错误上下文
 */
export function handleAudioError(error, context = {}) {
    return errorManager.handleError({
        type: ErrorType.AUDIO_ERROR,
        level: ErrorLevel.ERROR,
        message: typeof error === 'string' ? error : error.message,
        error: typeof error === 'object' ? error : new Error(error),
        context
    });
}

/**
 * UI错误处理函数
 * @param {Error|string} error - 错误对象或消息
 * @param {Object} context - 错误上下文
 */
export function handleUIError(error, context = {}) {
    return errorManager.handleError({
        type: ErrorType.UI_ERROR,
        level: ErrorLevel.ERROR,
        message: typeof error === 'string' ? error : error.message,
        error: typeof error === 'object' ? error : new Error(error),
        context
    });
}

/**
 * 配置错误处理函数
 * @param {Error|string} error - 错误对象或消息
 * @param {Object} context - 错误上下文
 */
export function handleConfigError(error, context = {}) {
    return errorManager.handleError({
        type: ErrorType.CONFIG_ERROR,
        level: ErrorLevel.WARNING,
        message: typeof error === 'string' ? error : error.message,
        error: typeof error === 'object' ? error : new Error(error),
        context
    });
}

/**
 * 训练模式错误处理函数
 * @param {Error|string} error - 错误对象或消息
 * @param {Object} context - 错误上下文
 */
export function handleTrainingError(error, context = {}) {
    return errorManager.handleError({
        type: ErrorType.TRAINING_ERROR,
        level: ErrorLevel.ERROR,
        message: typeof error === 'string' ? error : error.message,
        error: typeof error === 'object' ? error : new Error(error),
        context
    });
}

/**
 * 状态管理错误处理函数
 * @param {Error|string} error - 错误对象或消息
 * @param {Object} context - 错误上下文
 */
export function handleStateError(error, context = {}) {
    return errorManager.handleError({
        type: ErrorType.STATE_ERROR,
        level: ErrorLevel.WARNING,
        message: typeof error === 'string' ? error : error.message,
        error: typeof error === 'object' ? error : new Error(error),
        context
    });
}

/**
 * 应用错误处理函数
 * @param {Error|string} error - 错误对象或消息
 * @param {Object} context - 错误上下文
 */
export function handleAppError(error, context = {}) {
    return errorManager.handleError({
        type: ErrorType.APP_ERROR,
        level: ErrorLevel.CRITICAL,
        message: typeof error === 'string' ? error : error.message,
        error: typeof error === 'object' ? error : new Error(error),
        context
    });
}

// 临时导出handleError函数以兼容旧代码
export function handleError(errorInfo) {
    console.warn('使用了弃用的handleError函数，请使用特定的错误处理函数');
    return errorManager.handleError(errorInfo);
}

// 导出错误管理器实例
export { errorManager as errorHandler };