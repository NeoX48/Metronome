/**
 * 应用初始化模块 - 架构优化版
 * 实现依赖注入和模块化初始化流程
 * @module init
 */

// 导入核心模块
import { scheduler } from '../audio/scheduler.js';
import { initMetronome, getMetronome } from '../core/metronome.js';
import { uiController } from '../ui/controls.js';
import { initTrainingMode } from '../training/trainingCore.js';
import { trainingUIController } from '../training/trainingUI.js';
import { keyboardController } from './keyboard.js';
import { handleAudioError, handleUIError, handleTrainingError, handleConfigError, isAudioContextError } from './errorManager.js';
import { AudioErrorBoundary } from './audioErrorBoundary.js';

/**
 * 应用初始化器 - 基于架构优化方案
 * 实现依赖管理、生命周期控制和错误处理
 * @class AppInitializer
 */
export const AppInitializer = { 
    // 内部状态
    _isInitializing: false, 
    _isInitialized: false,
    
    // 模块注册表 - 记录所有需要初始化的模块
    _moduleRegistry: {},
    
    // 依赖图 - 记录模块间依赖关系
    _dependencyGraph: {},
    
    // 已初始化模块缓存
    _initializedModules: {},
    
    /**
     * 初始化应用程序
     * 按正确的依赖顺序初始化各个模块
     * @returns {Promise<void>}
     */
    /**
     * 初始化应用程序
     * @param {Object} options - 初始化选项
     * @param {boolean} options.useDependencyGraph - 是否使用依赖图初始化
     * @returns {Promise<boolean>} 初始化是否成功
     */
    async initialize(options = {}) { 
        if (this._isInitializing) {
            console.warn('[初始化] 已有初始化进程正在运行');
            return false;
        }
        
        if (this._isInitialized) {
            console.log('[初始化] 应用已初始化，跳过重复初始化');
            return true;
        }
        
        this._isInitializing = true;
        
        try { 
            // 配置初始化选项
            const { useDependencyGraph = false } = options;
            
            // 注册核心模块（仅在使用依赖图时需要）
            if (useDependencyGraph) {
                // 注册模块并定义依赖关系
                this.registerModule('scheduler', scheduler, []); // 调度器无依赖
                this.registerModule('metronome', { init: async () => await initMetronome() }, ['scheduler']); // 节拍器依赖调度器
                this.registerModule('uiController', uiController, []); // UI控制器无依赖
                this.registerModule('keyboardController', keyboardController, ['uiController']); // 键盘控制器依赖UI控制器
                this.registerModule('trainingCore', { init: () => initTrainingMode() }, []); // 训练核心无依赖
                this.registerModule('trainingUIController', trainingUIController, ['metronome', 'uiController']); // 训练UI依赖节拍器和UI控制器
            }
            
            // 根据选项选择初始化方式
            if (useDependencyGraph && Object.keys(this._moduleRegistry).length > 0) {
                // 使用依赖图初始化（新方式）
                await this._initializeWithDependencyGraph();
            } else {
                // 使用传统初始化流程（兼容旧代码）
                // 强制初始化顺序 
                // 1. 初始化音频调度器
                await scheduler.init().catch(error => {
                    const wrappedError = new Error(`调度器初始化失败: ${error.message}`);
                    wrappedError.originalError = error;
                    throw wrappedError;
                });
                console.log('音频调度器初始化完成');
                
                // 2. 初始化节拍器核心
                const metronome = await initMetronome().catch(error => {
                    const wrappedError = new Error(`节拍器初始化失败: ${error.message}`);
                    wrappedError.originalError = error;
                    throw wrappedError;
                });
                console.log('核心节拍器模块初始化完成');
                
                // 3. 初始化UI控制器
                await uiController.init().catch(error => handleUIError(error, { context: '初始化UI控制器' }));
                console.log('UI控制器初始化完成');
                
                // 4. 初始化训练模式核心逻辑
                try {
                    initTrainingMode();
                    console.log('训练模式核心逻辑初始化完成');
                } catch (error) {
                    handleTrainingError(error, { context: '初始化训练模式' });
                }
                
                // 5. 初始化训练模式UI
                await trainingUIController.init(metronome).catch(error => handleUIError(error, { context: '初始化训练UI' }));
                console.log('训练模式UI初始化完成');
                
                // 6. 初始化键盘控制器
                try {
                    keyboardController.init();
                    console.log('键盘控制器初始化完成');
                } catch (error) {
                    handleUIError(error, { context: '初始化键盘控制' });
                }
                
                // 7. 加载配置
                try {
                    const { getConfig } = await import('./config.js');
                    const config = getConfig();
                    console.log(`应用配置版本: ${config.version || '未知'}`);
                } catch (error) {
                    handleConfigError(error, { context: '加载应用配置' });
                }
                
                // 获取最终的节拍器实例以显示状态
                const finalMetronome = getMetronome();
                
                // 记录初始化的模块
                this._initializedModules = {
                    scheduler,
                    metronome: finalMetronome,
                    uiController,
                    keyboardController,
                    trainingUIController
                };
            }
            
            // 初始化完成标志
            this._isInitialized = true;
            console.log('[初始化] 应用程序初始化成功');
            
            // 如果之前有音频错误，重置错误状态
            if (AudioErrorBoundary && typeof AudioErrorBoundary.resetError === 'function') {
                AudioErrorBoundary.resetError();
            }
            
            return true;
        } catch (error) { 
            console.error('[初始化失败]', error); 
            
            // 处理音频上下文错误
            if (isAudioContextError(error) || isAudioContextError(error.originalError)) {
                // 使用AudioErrorBoundary处理
                if (AudioErrorBoundary && typeof AudioErrorBoundary.catchError === 'function') {
                    AudioErrorBoundary.catchError(error, { context: '应用初始化' });
                } else {
                    // 降级处理
                    handleAudioError(error, { context: '应用初始化' });
                }
            } else {
                // 其他错误
                handleUIError(error, { context: '应用初始化' });
            }
            
            throw error; // 重新抛出错误，让main.js知道初始化失败
        } finally {
            this._isInitializing = false;
        }
    },
    
    /**
     * 处理初始化错误并重试
     * @param {Error} error - 初始化过程中发生的错误
     * @private
     * @deprecated 使用AudioErrorBoundary代替自动重试
     */
    _handleRetry(error) { 
        // 现在由AudioErrorBoundary处理重试逻辑，此方法保留以保持兼容性
        console.debug('[初始化] 重试处理已移至AudioErrorBoundary');
    },
    
    /**
     * 注册需要初始化的模块
     * @param {string} moduleId - 模块唯一标识
     * @param {Object} module - 模块对象
     * @param {Array<string>} dependencies - 依赖模块ID列表
     */
    registerModule(moduleId, module, dependencies = []) {
        this._moduleRegistry[moduleId] = {
            id: moduleId,
            module: module,
            dependencies: dependencies,
            initialized: false,
            instance: null
        };
        
        // 更新依赖图
        if (!this._dependencyGraph[moduleId]) {
            this._dependencyGraph[moduleId] = [];
        }
        
        for (const depId of dependencies) {
            if (!this._dependencyGraph[depId]) {
                this._dependencyGraph[depId] = [];
            }
            this._dependencyGraph[depId].push(moduleId);
        }
    },
    
    /**
     * 计算模块初始化顺序
     * @private
     * @returns {Array<string>} 模块初始化顺序列表
     */
    _calculateInitializationOrder() {
        const visited = new Set();
        const result = [];
        
        // 检测循环依赖并计算拓扑排序
        function dfs(moduleId, path = []) {
            if (path.includes(moduleId)) {
                throw new Error(`检测到循环依赖: ${path.join(' -> ')} -> ${moduleId}`);
            }
            
            if (visited.has(moduleId)) {
                return;
            }
            
            visited.add(moduleId);
            path.push(moduleId);
            
            // 先初始化依赖项
            const module = this._moduleRegistry[moduleId];
            if (module && module.dependencies) {
                for (const depId of module.dependencies) {
                    if (this._moduleRegistry[depId]) {
                        dfs.call(this, depId, [...path]);
                    }
                }
            }
            
            result.push(moduleId);
        }
        
        // 遍历所有模块进行深度优先搜索
        for (const moduleId in this._moduleRegistry) {
            if (!visited.has(moduleId)) {
                dfs.call(this, moduleId);
            }
        }
        
        return result;
    },
    
    /**
     * 初始化单个模块
     * @private
     * @param {string} moduleId - 模块ID
     * @returns {Promise<Object>} 初始化后的模块实例
     */
    async _initializeModule(moduleId) {
        const moduleDef = this._moduleRegistry[moduleId];
        if (!moduleDef || moduleDef.initialized) {
            return moduleDef?.instance;
        }
        
        console.log(`[初始化] 开始初始化模块: ${moduleId}`);
        
        try {
            // 准备依赖项实例
            const dependencyInstances = {};
            for (const depId of moduleDef.dependencies) {
                if (this._initializedModules[depId]) {
                    dependencyInstances[depId] = this._initializedModules[depId];
                }
            }
            
            // 初始化模块
            const instance = moduleDef.module;
            if (typeof instance.initialize === 'function') {
                await instance.initialize(dependencyInstances);
            } else if (typeof instance.init === 'function') {
                // 兼容旧版init方法
                await instance.init();
            }
            
            // 记录初始化状态
            moduleDef.initialized = true;
            moduleDef.instance = instance;
            this._initializedModules[moduleId] = instance;
            
            console.log(`[初始化] 模块初始化成功: ${moduleId}`);
            return instance;
        } catch (error) {
            console.error(`[初始化] 模块初始化失败: ${moduleId}`, error);
            throw error;
        }
    },
    
    /**
     * 传统初始化流程（兼容旧代码）
     * @private
     * @returns {Promise<void>}
     */
    async _legacyInitialize() {
        // 强制初始化顺序 
        // 1. 初始化音频调度器
        await scheduler.init().catch(error => {
            const wrappedError = new Error(`调度器初始化失败: ${error.message}`);
            wrappedError.originalError = error;
            throw wrappedError;
        });
        console.log('音频调度器初始化完成');
        
        // 2. 初始化节拍器核心
        const metronome = await initMetronome().catch(error => {
            const wrappedError = new Error(`节拍器初始化失败: ${error.message}`);
            wrappedError.originalError = error;
            throw wrappedError;
        });
        console.log('核心节拍器模块初始化完成');
        
        // 3. 初始化UI控制器
        await uiController.init().catch(error => handleUIError(error, { context: '初始化UI控制器' }));
        console.log('UI控制器初始化完成');
        
        // 4. 初始化训练模式核心逻辑
        try {
            initTrainingMode();
            console.log('训练模式核心逻辑初始化完成');
        } catch (error) {
            handleTrainingError(error, { context: '初始化训练模式' });
        }
        
        // 5. 初始化训练模式UI
        await trainingUIController.init(metronome).catch(error => handleUIError(error, { context: '初始化训练UI' }));
        console.log('训练模式UI初始化完成');
        
        // 6. 初始化键盘控制器
        try {
            keyboardController.init();
            console.log('键盘控制器初始化完成');
        }
        catch (error) {
            handleUIError(error, { context: '初始化键盘控制' });
        }
        
        // 7. 加载配置
        try {
            const { getConfig } = await import('./config.js');
            const config = getConfig();
            console.log(`应用配置版本: ${config.version || '未知'}`);
        } catch (error) {
            handleConfigError(error, { context: '加载应用配置' });
        }
        
        // 获取最终的节拍器实例以显示状态
        const finalMetronome = getMetronome();
        console.log('[初始化] 完成状态:', { 
            scheduler: scheduler.status || 'initialized', 
            metronome: finalMetronome ? 'initialized' : 'failed' 
        });
    },
    
    /**
     * 使用依赖图进行初始化
     * @private
     */
    async _initializeWithDependencyGraph() {
        try {
            // 计算初始化顺序
            const initializationOrder = this._calculateInitializationOrder();
            console.log('[初始化] 模块初始化顺序:', initializationOrder.join(' → '));
            
            // 按顺序初始化每个模块
            for (const moduleId of initializationOrder) {
                await this._initializeModule(moduleId);
            }
            
            // 记录初始化完成的模块
            console.log('[初始化] 模块初始化状态:');
            for (const moduleId in this._moduleRegistry) {
                const status = this._moduleRegistry[moduleId].initialized ? '✅' : '❌';
                console.log(`  ${status} ${moduleId}`);
            }
        } catch (error) {
            // 处理初始化错误
            if (isAudioContextError(error) || isAudioContextError(error.originalError)) {
                throw error;
            }
            throw new Error(`依赖图初始化失败: ${error.message}`);
        }
    },
    
    /**
     * 手动触发重试初始化
     * 用于音频错误边界恢复机制
     * @param {Object} options - 初始化选项
     * @returns {Promise<boolean>} 重试是否成功
     */
    async retryInitialize(options = {}) {
        if (this._isInitializing) {
            console.warn('[初始化] 已有初始化进程正在运行');
            return false;
        }
        
        this._isInitializing = true;
        
        try {
            console.log('[初始化] 开始手动重试初始化...');
            
            // 重置状态
            this._isInitialized = false;
            this._initializedModules = {};
            
            // 重置注册的模块状态
            for (const moduleId in this._moduleRegistry) {
                this._moduleRegistry[moduleId].initialized = false;
                this._moduleRegistry[moduleId].instance = null;
            }
            
            // 重置调度器状态（音频错误恢复的关键）
            if (scheduler) {
                if (typeof scheduler.reset === 'function') {
                    scheduler.reset();
                } else if (typeof scheduler.init === 'function') {
                    // 降级方案：重新初始化调度器
                    await scheduler.init();
                }
                console.log('[初始化] 调度器已重置/重新初始化');
            }
            
            // 重新初始化
            const result = await this.initialize(options);
            console.log('[初始化] 手动重试成功');
            return result;
        } catch (error) {
            console.error('[初始化] 手动重试失败:', error);
            throw error;
        } finally {
            this._isInitializing = false;
        }
    },
    
    /**
     * 获取已初始化的模块实例
     * @param {string} moduleId - 模块ID
     * @returns {Object|null} 模块实例或null
     */
    getModule(moduleId) {
        return this._initializedModules[moduleId] || null;
    },
    
    /**
     * 获取初始化状态
     * @returns {Object} 初始化状态信息
     */
    getStatus() {
        return {
            isInitialized: this._isInitialized,
            isInitializing: this._isInitializing,
            initializedModules: Object.keys(this._initializedModules),
            registeredModules: Object.keys(this._moduleRegistry)
        };
    },
    
    /** 
     * 应用销毁方法 
     */ 
    async destroy() { 
      try { 
        await uiController?.destroy(); // 安全调用 
        await scheduler?.shutdown(); 
        keyboardController?.unbind(); 
      } catch (error) { 
        console.error('[资源释放失败]', error); 
      } 
    }
};