/**
 * 音频调度器模块 - 精确控制音频事件的时序
 * 
 * @module scheduler
 * @description 提供高精度的音频事件调度功能，确保节拍播放的准确性、稳定性和错误恢复能力
 */

import { getState } from '../utils/state.js';
import { getConfig } from '../utils/config.js';
import { handleAudioError } from '../utils/errorManager.js';
import { throttle } from '../utils/helpers.js';

/**
 * 调度器实例
 * @type {Object}
 * @property {boolean} isRunning - 调度器是否正在运行
 * @property {number} currentBeat - 当前节拍编号
 * @property {number} nextBeatTime - 下一个节拍的时间
 * @property {Function} schedulerCallback - 调度回调函数
 */
export const scheduler = {
    audioContext: null,
    isRunning: false,
    currentBeat: 1,
    nextBeatTime: 0,
    schedulerCallback: null,
    lookahead: 25.0, // 提前调度的毫秒数
    scheduleAheadTime: 0.2, // 调度提前量（秒）
    lastUpdateTime: 0,
    timerID: null,
    
    // 性能优化相关属性
    minScheduleInterval: 1, // 最小调度间隔（毫秒）
    maxScheduleInterval: 100, // 最大调度间隔（毫秒）
    
    // 错误恢复和稳定性相关
    errorCount: 0,
    maxAllowedErrors: 3,
    recoveryTimeout: null,
    
    // 性能统计
    performanceStats: {
        beatsScheduled: 0,
        successfulBeats: 0,
        failedBeats: 0,
        averageLatency: 0,
        totalLatency: 0,
        startTime: null
    },
    
    /**
     * 初始化调度器
     * @returns {Promise<void>}
     * 
     * @example
     * // 初始化调度器
     * await scheduler.init();
     */
    /**
     * 初始化调度器
     * @returns {Promise<void>}
     * @throws {Error} 当初始化失败时抛出错误
     * 
     * @example
     * // 初始化调度器
     * await scheduler.init();
     */
    async init() {
        // 防止重复初始化
        if (this.audioContext) {
            console.warn('音频调度器已经初始化');
            return;
        }
        
        try {
            // 重置性能统计
            this.performanceStats = {
                beatsScheduled: 0,
                successfulBeats: 0,
                failedBeats: 0,
                averageLatency: 0,
                totalLatency: 0,
                startTime: null
            };
            
            // 获取配置参数，添加默认值作为后备
            let sampleRate, latencyHint;
            try {
                sampleRate = getConfig('audio.sampleRate') || 44100;
                latencyHint = getConfig('audio.latencyHint') || 'interactive';
            } catch (configError) {
                sampleRate = 44100;
                latencyHint = 'interactive';
                console.warn('使用默认音频配置:', { sampleRate, latencyHint });
            }
            
            // 创建音频上下文
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate,
                latencyHint
            });
            
            // 如果音频上下文被挂起，恢复它
            if (this.audioContext.state === 'suspended') {
                try {
                    await this.audioContext.resume();
                } catch (resumeError) {
                    // 恢复失败不应该阻止初始化
                    console.warn('音频上下文恢复失败，但继续初始化:', resumeError);
                }
            }
            
            // 添加音频上下文状态变化监听
            this.audioContext.onstatechange = () => {
                console.log(`音频上下文状态变化: ${this.audioContext.state}`);
                // 如果状态变为'closed'，重置调度器
                if (this.audioContext.state === 'closed') {
                    this.reset();
                }
            };
            
            console.log('音频调度器初始化成功');
        } catch (error) {
            const handledError = handleAudioError(error, { context: '初始化音频调度器' });
            throw handledError;
        }
    },
    
    /**
     * 开始调度器
     * @param {Function} callback - 每个节拍触发的回调函数
     * 
     * @example
     * // 开始调度
     * scheduler.start((beatTime, beatNumber) => {
     *   console.log(`节拍 ${beatNumber} 在时间 ${beatTime} 触发`);
     * });
     */
    /**
     * 开始调度器
     * @param {Function} callback - 每个节拍触发的回调函数
     * @returns {boolean} 开始是否成功
     * 
     * @example
     * // 开始调度
     * scheduler.start((beatTime, beatNumber) => {
     *   console.log(`节拍 ${beatNumber} 在时间 ${beatTime} 触发`);
     * });
     */
    start(callback) {
        // 前置条件检查
        if (!this.audioContext) {
            const error = new Error('音频上下文未初始化');
            handleAudioError(error, { context: '调度器开始' });
            return false;
        }
        
        if (this.isRunning) {
            console.warn('调度器已经在运行');
            return true;
        }
        
        // 验证回调函数
        if (typeof callback !== 'function') {
            const error = new Error('回调必须是一个函数');
            handleAudioError(error, { context: '验证调度器回调' });
            return false;
        }
        
        try {
            this.schedulerCallback = callback;
            this.isRunning = true;
            this.currentBeat = 1;
            this.errorCount = 0; // 重置错误计数
            
            // 设置初始性能统计
            this.performanceStats.startTime = Date.now();
            
            // 设置初始节拍时间
            let state, interval;
            try {
                state = getState();
                interval = 60.0 / state.bpm;
            } catch (stateError) {
                handleAudioError(stateError, { context: '获取BPM状态' });
                interval = 60.0 / 120; // 默认BPM为120
            }
            
            // 设置初始节拍时间 - 增加延迟防止第一拍叠音
        this.nextBeatTime = this.audioContext.currentTime + 0.2; // 200ms的初始延迟
        this.lastUpdateTime = Date.now();
            
            // 开始调度循环
            this.schedulerLoop();
            return true;
        } catch (error) {
            handleAudioError(error, { context: '启动调度器' });
            this.stop();
            return false;
        }
    },
    
    /**
     * 停止调度器
     * @returns {void}
     * 
     * @example
     * // 停止调度
     * scheduler.stop();
     */
    stop() {
        this.isRunning = false;
        
        // 清除定时器
        if (this.timerID !== null) {
            try {
                window.clearTimeout(this.timerID);
                this.timerID = null;
            } catch (error) {
                console.warn('清除定时器失败:', error);
            }
        }
        
        // 清除恢复超时
        if (this.recoveryTimeout !== null) {
            try {
                window.clearTimeout(this.recoveryTimeout);
                this.recoveryTimeout = null;
            } catch (error) {
                console.warn('清除恢复超时失败:', error);
            }
        }
        
        // 重置状态
        this.schedulerCallback = null;
        this.currentBeat = 1;
        this.errorCount = 0;
    },
    
    /**
     * 更新调度间隔
     * 
     * @example
     * // 当BPM改变时更新调度间隔
     * scheduler.updateInterval();
     */
    /**
     * 更新调度间隔
     * @returns {boolean} 更新是否成功
     * 
     * @example
     * // 当BPM改变时更新调度间隔
     * scheduler.updateInterval();
     */
    updateInterval() {
        try {
            const state = getState();
            // 只需重新对齐时间基准到未来，避免半拍错位
            const currentTime = this.audioContext.currentTime;
            this.nextBeatTime = currentTime + 0.15;
            // 不强制修改 currentBeat（可保持节拍序号），如需重置可改为 this.currentBeat = 1;
            return true;
        } catch (error) {
            handleAudioError(error, { context: '更新调度间隔' });
            return false;
        }
    },
    
    /**
     * 调度循环函数
     * @private
     */
    /**
     * 调度循环函数
     * @private
     */
    schedulerLoop() {
        if (!this.isRunning) {
            return;
        }
        
        // 性能优化：限制调度循环的执行频率
        if (this.lastUpdateTime && (Date.now() - this.lastUpdateTime < this.minScheduleInterval)) {
            // 跳过过于频繁的调用
            this.timerID = window.setTimeout(() => this.schedulerLoop(), this.minScheduleInterval);
            return;
        }
        
        this.lastUpdateTime = Date.now();
        
        try {
            let state, interval;
            try {
                state = getState();
                interval = 60.0 / state.bpm;
            } catch (stateError) {
                handleAudioError(stateError, { context: '获取调度循环的BPM状态' });
                // 使用默认值继续运行
                interval = 60.0 / 120;
            }
            
            // 检查音频上下文状态
            if (!this.audioContext || this.audioContext.state === 'closed') {
                handleAudioError(new Error('音频上下文已关闭'), { context: '调度循环音频上下文检查' });
                this.stop();
                return;
            }
            
            // 如果音频上下文被挂起，尝试恢复
            if (this.audioContext.state === 'suspended') {
            // 尝试恢复，但本轮不继续排程，避免不断错过拍点
                this.audioContext.resume().catch(e => console.warn('音频上下文恢复失败:', e));
                this.timerID = window.setTimeout(() => this.schedulerLoop(), 50);
            return;
            }
            
            const currentTime = this.audioContext.currentTime;
            
            // 调度未来的节拍 - 添加安全限制防止无限循环
            let scheduleCount = 0;
            const maxSchedulesPerIteration = 20; // 每轮最多调度的节拍数
            
            while (this.nextBeatTime < currentTime + this.scheduleAheadTime && 
                   scheduleCount < maxSchedulesPerIteration) {
                scheduleCount++;
                
                try {
                    // 更新性能统计
                    this.performanceStats.beatsScheduled++;
                    
                    // 计算实际延迟
                    const actualTime = this.audioContext.currentTime;
                    const latency = this.nextBeatTime - actualTime;
                    this.performanceStats.totalLatency += Math.abs(latency);
                    
                    // 调用回调函数调度节拍
                    if (this.schedulerCallback) {
                        this.schedulerCallback(this.nextBeatTime, this.currentBeat);
                    }
                    
                    // 更新成功节拍计数
                    this.performanceStats.successfulBeats++;
                    
                    // 更新平均延迟
                    this.performanceStats.averageLatency = 
                        this.performanceStats.totalLatency / this.performanceStats.successfulBeats;
                    
                    // 计算下一个节拍时间
                    this.nextBeatTime += interval;
                    
                    // 更新节拍编号（循环）
                    this.currentBeat = (this.currentBeat % state.beatNumerator) + 1;
                    
                    // 重置错误计数，因为成功调度了一个节拍
                    this.errorCount = 0;
                    
                } catch (error) {
                    this.errorCount++;
                    handleAudioError(error, { 
                        context: `调度节拍 ${this.currentBeat}`,
                        additionalInfo: { errorCount: this.errorCount, maxAllowedErrors: this.maxAllowedErrors }
                    });
                    
                    // 如果错误次数过多，停止调度器
                    if (this.errorCount >= this.maxAllowedErrors) {
                        console.warn(`错误次数超过限制 (${this.errorCount}/${this.maxAllowedErrors})，停止调度器`);
                        this.stop();
                        this.attemptRecovery();
                        return;
                    }
                    
                    // 更新失败节拍计数
                    this.performanceStats.failedBeats++;
                    
                    // 即使出现错误，也要继续计算下一个节拍
                    this.nextBeatTime += interval;
                    this.currentBeat = (this.currentBeat % state.beatNumerator) + 1;
                }
            }
            
            // 计算下一次调度的时间
            const timeUntilNextSchedule = (this.nextBeatTime - currentTime - this.scheduleAheadTime) * 1000;
            let scheduleTime;
            if (timeUntilNextSchedule <= 0) {
                // 已落后，立即再跑一轮补排
                scheduleTime = 0;
            } else {
                scheduleTime = Math.max(
                    this.minScheduleInterval, 
                    Math.min(timeUntilNextSchedule, this.maxScheduleInterval)
                );
            }
            
            // 设置下一次调度 - 使用安全的方式设置定时器
            try {
                if (this.isRunning) { // 再次检查运行状态，因为可能在上面的代码中被设置为停止
                    this.timerID = window.setTimeout(() => this.schedulerLoop(), scheduleTime);
                }
            } catch (timerError) {
                handleAudioError(timerError, { context: '设置调度定时器' });
                this.stop();
            }
            
        } catch (error) {
            handleAudioError(error, { context: '调度循环主错误' });
            this.stop();
        }
    },
    
    /**
     * 获取音频上下文状态
     * @returns {string} 音频上下文状态
     */
    /**
     * 获取音频上下文状态
     * @returns {string} 音频上下文状态
     */
    getAudioContextState() {
        return this.audioContext ? this.audioContext.state : 'uninitialized';
    },
    
    /**
     * 恢复音频上下文
     * @returns {Promise<boolean>} 恢复是否成功
     */
    async resumeAudio() {
        try {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
                return true;
            }
            return false;
        } catch (error) {
            handleAudioError(error, { context: '恢复音频上下文' });
            return false;
        }
    },
    
    /**
     * 暂停音频上下文
     * @returns {Promise<boolean>} 暂停是否成功
     */
    async suspendAudio() {
        try {
            if (this.audioContext && this.audioContext.state === 'running') {
                await this.audioContext.suspend();
                return true;
            }
            return false;
        } catch (error) {
            handleAudioError(error, { context: '暂停音频上下文' });
            return false;
        }
    },
    
    /**
     * 重置调度器到初始状态
     * @returns {void}
     */
    reset() {
        this.stop();
        this.audioContext = null;
        this.nextBeatTime = 0;
        this.lastUpdateTime = 0;
        
        // 重置性能统计
        this.performanceStats = {
            beatsScheduled: 0,
            successfulBeats: 0,
            failedBeats: 0,
            averageLatency: 0,
            totalLatency: 0,
            startTime: null
        };
        
        console.log('调度器已重置');
    },
    
    /**
     * 尝试从错误中恢复
     * @private
     */
    attemptRecovery() {
        // 避免重复触发恢复
        if (this.recoveryTimeout) {
            return;
        }
        
        console.log('尝试恢复调度器...');
        
        this.recoveryTimeout = window.setTimeout(async () => {
            try {
                // 重置错误计数
                this.errorCount = 0;
                
                // 如果音频上下文已关闭，重新初始化
                if (!this.audioContext || this.audioContext.state === 'closed') {
                    await this.init();
                }
                
                console.log('调度器恢复尝试完成');
            } catch (recoveryError) {
                handleAudioError(recoveryError, { context: '调度器恢复' });
                console.warn('调度器恢复失败');
            } finally {
                this.recoveryTimeout = null;
            }
        }, 1000); // 延迟1秒后尝试恢复
    },
    
    /**
     * 获取调度器状态信息
     * @returns {Object} 包含调度器当前状态的对象
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            currentBeat: this.currentBeat,
            audioContextState: this.getAudioContextState(),
            errorCount: this.errorCount,
            nextBeatTime: this.nextBeatTime,
            scheduleAheadTime: this.scheduleAheadTime
        };
    },
    
    /**
     * 获取性能统计信息
     * @returns {Object} 性能统计数据
     */
    getPerformanceStats() {
        return {
            beatsScheduled: this.performanceStats.beatsScheduled,
            successfulBeats: this.performanceStats.successfulBeats,
            failedBeats: this.performanceStats.failedBeats,
            averageLatency: this.performanceStats.averageLatency,
            uptime: this.performanceStats.startTime ? Date.now() - this.performanceStats.startTime : 0
        };
    },
    
    /**
     * 检查调度器是否已初始化
     * @returns {boolean} 是否已初始化
     */
    isInitialized() {
        return this.audioContext !== null;
    }
};



/**
 * 清理所有资源
 * @returns {void}
 */
export function cleanupScheduler() {
    try {
        // 停止调度器
        scheduler.stop();
        
        // 如果有音频上下文，尝试关闭它
        if (scheduler.audioContext && scheduler.audioContext.state !== 'closed') {
            scheduler.audioContext.close().catch(e => 
                console.warn('关闭音频上下文失败:', e)
            );
        }
        
        console.log('调度器资源已清理');
    } catch (error) {
        handleAudioError(error, { context: '清理调度器资源' });
    }
}