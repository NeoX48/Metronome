/**
 * 音频缓冲区模块 - 管理节拍器的音效资源
 * 
 * @module soundBuffers
 * @description 负责创建、加载和播放各种节拍音效，包含性能优化和错误处理
 */

import { scheduler } from './scheduler.js';
import { getConfig } from '../utils/config.js';
import { handleAudioError } from '../utils/errorManager.js';
import { debounce, throttle } from '../utils/helpers.js';

/**
 * 音频缓冲区存储对象
 * @type {Object}
 */
const soundBuffers = {};

/**
 * 是否已初始化
 * @type {boolean}
 */
let initialized = false;

/**
 * 初始化进行状态
 * @type {boolean}
 */
let initInProgress = false;

/**
 * 资源加载状态跟踪
 * @type {Object}
 */
const loadingState = {
    isLoading: false,
    loadedCount: 0,
    totalCount: 0,
    loadStartTime: 0
};

/**
 * 性能统计
 * @type {Object}
 */
const performanceStats = {
    totalPlays: 0,
    successfulPlays: 0,
    failedPlays: 0,
    averagePlayTime: 0,
    lastPlayTime: 0
};


/**
 * 初始化音频缓冲区
 * @returns {Promise<void>}
 * 
 * @example
 * // 初始化音频缓冲区
 * await initSoundBuffers();
 */
export async function initSoundBuffers() {
    // 防止重复初始化
    if (initInProgress) {
        console.warn('音频缓冲区初始化已在进行中');
        return;
    }
    
    if (initialized) {
        console.warn('音频缓冲区已经初始化');
        return;
    }
    
    initInProgress = true;
    loadingState.isLoading = true;
    loadingState.loadedCount = 0;
    loadingState.loadStartTime = Date.now();
    
    // 触发初始化开始事件
    window.dispatchEvent(new CustomEvent('audio:initStart'));
    
    try {
        if (!scheduler || !scheduler.audioContext) {
            throw new Error('音频上下文未初始化');
        }
        
        // 获取音效配置
        const soundGenerators = [
            { name: 'high', generator: generateHighClick },
            { name: 'low', generator: generateLowClick },
            { name: 'medium', generator: generateMediumClick },
            { name: 'click', generator: generateClickSound },
            { name: 'beep', generator: generateBeepSound }
        ];
        
        loadingState.totalCount = soundGenerators.length;
        
        // 创建不同类型的音效 - 使用Promise.allSettled确保一个失败不会影响其他
        const results = await Promise.allSettled(
            soundGenerators.map(({ name, generator }) => createSoundBuffer(name, generator))
        );
        
        // 检查结果并更新状态
        const failedBuffers = results.filter(result => result.status === 'rejected');
        const successfulBuffers = results.filter(result => result.status === 'fulfilled');
        
        loadingState.loadedCount = successfulBuffers.length;
        
        if (failedBuffers.length > 0) {
            console.warn(`部分音效初始化失败: ${failedBuffers.length}/${loadingState.totalCount}`);
            failedBuffers.forEach((result, index) => {
                handleAudioError(result.reason, { context: `初始化音效缓冲区 ${soundGenerators[index].name}` });
            });
        }
        
        // 只有在至少有一个成功时才标记为初始化完成
        initialized = successfulBuffers.length > 0;
        
        const initTime = Date.now() - loadingState.loadStartTime;
        console.log(`音频缓冲区初始化${initialized ? '成功' : '部分成功'}: ${successfulBuffers.length}/${loadingState.totalCount} 个音效 (${initTime}ms)`);
        
        // 触发初始化完成事件
        window.dispatchEvent(new CustomEvent('audio:initComplete', {
            detail: {
                success: initialized,
                loadedCount: successfulBuffers.length,
                totalCount: loadingState.totalCount,
                initTime
            }
        }));
    } catch (error) {
        const handledError = handleAudioError(error, { context: '初始化音频缓冲区' });
        
        // 触发初始化失败事件
        window.dispatchEvent(new CustomEvent('audio:initFailed', {
            detail: { error: error.message }
        }));
        
        throw handledError;
    } finally {
        loadingState.isLoading = false;
        // 重置初始化状态
        setTimeout(() => {
            initInProgress = false;
        }, 500);
    }
}

/**
 * 音频缓冲区缓存
 * @type {Map<string, AudioBuffer>}
 */
const soundBufferCache = new Map();

/**
 * 创建音频缓冲区
 * @param {string} name - 缓冲区名称
 * @param {Function} generator - 音频数据生成函数
 * @returns {Promise<void>}
 * @private
 */
async function createSoundBuffer(name, generator) {
    try {
        const context = scheduler.audioContext;
        
        if (!context) {
            throw new Error('音频上下文不可用');
        }
        
        // 参数验证
        if (typeof name !== 'string' || typeof generator !== 'function') {
            throw new Error('无效的参数类型');
        }
        
        // 检查缓存是否已有
        if (soundBufferCache.has(name)) {
            console.debug(`重用已有音效缓冲区: ${name}`);
            soundBuffers[name] = soundBufferCache.get(name);
            return;
        }
        
        // 获取缓冲区大小，如果配置不存在则使用默认值
        let bufferSize;
        try {
            bufferSize = getConfig('audio.bufferSize') || 4096;
            // 验证缓冲区大小的合理性
            bufferSize = Math.max(512, Math.min(16384, Math.round(bufferSize)));
        } catch (error) {
            bufferSize = 4096; // 默认缓冲区大小
            console.warn('使用默认缓冲区大小:', bufferSize);
        }
        
        // 性能优化：使用AudioWorklet或更高效的方式创建缓冲区
        // 这里使用标准的createBuffer方法
        const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
        const data = buffer.getChannelData(0);
        
        // 预填充为静音，防止未初始化的数值
        data.fill(0);
        
        // 使用生成器填充音频数据
        try {
            const startTime = performance.now();
            generator(data, context.sampleRate, bufferSize);
            const generateTime = performance.now() - startTime;
            
            // 性能监控
            if (generateTime > 5) {
                console.warn(`音效生成时间较长: ${name} (${generateTime.toFixed(2)}ms)`);
            }
            
            // 音频数据完整性检查
            for (let i = 0; i < data.length; i++) {
                if (isNaN(data[i]) || !isFinite(data[i])) {
                    data[i] = 0;
                }
                // 硬限幅，防止音频失真
                data[i] = Math.max(-1, Math.min(1, data[i]));
            }
            
        } catch (genError) {
            handleAudioError(genError, { context: `生成音效数据: ${name}` });
            // 填充静音数据作为后备
            data.fill(0);
        }
        
        // 存储到缓存和主对象中
        soundBuffers[name] = buffer;
        soundBufferCache.set(name, buffer);
        
        // 触发缓冲区创建事件
        window.dispatchEvent(new CustomEvent('audio:bufferCreated', {
            detail: { name }
        }));
        
    } catch (error) {
        handleAudioError(error, { context: `创建音频缓冲区: ${name}` });
        throw error;
    }
}

/**
 * 活跃音频节点跟踪
 * @type {Map<string, {source: AudioBufferSourceNode, gainNode: GainNode}>}
 */
const activeAudioNodes = new Map();
let nodeCounter = 0;

/**
 * 音频节点最大生命周期（毫秒）
 */
const MAX_NODE_LIFETIME = 5000; // 5秒

/**
 * 清理过期音频节点的定时器ID
 */
let cleanupTimerId = null;

/**
 * 内部播放音效函数
 * @param {Object} options - 播放选项
 * @returns {boolean} 是否播放成功
 * @private
 */
/**
 * 获取音效的实际持续时间
 * @param {string} soundType - 音效类型
 * @returns {number} 持续时间（秒）
 * @private
 */
function getActualSoundDuration(soundType) {
    const durations = {
        'high': 0.02,    // generateHighClick 的 duration
        'low': 0.03,     // generateLowClick 的 duration
        'medium': 0.025, // generateMediumClick 的 duration
        'click': 0.01,   // generateClickSound 的 duration
        'beep': 0.05     // generateBeepSound 的 duration
    };
    
    return durations[soundType] || 0.03; // 默认 30ms
}

/**
 * 内部播放音效函数
 * @param {Object} options - 播放选项
 * @returns {boolean} 是否播放成功
 * @private
 */
function playSoundInternal(options) {
    try {
        const perfStartTime = performance.now();
        
        // 快速前置检查
        if (!initialized || !scheduler || !scheduler.audioContext) {
            handleAudioError(new Error('音频系统未初始化'), { context: '播放音效前置检查' });
            return false;
        }
        
        if (!options || typeof options !== 'object') {
            handleAudioError(new Error('无效的播放选项'), { context: '验证播放选项' });
            return false;
        }
        
        const {
            type = 'regularBeat',
            time = scheduler.audioContext.currentTime,
            volume = 1.0
        } = options;
        
        // 获取音效配置
        let soundType;
        try {
            soundType = type === 'firstBeat' 
                ? getConfig('sounds.firstBeatSound') || 'high'
                : getConfig('sounds.regularBeatSound') || 'medium';
        } catch (error) {
            soundType = type === 'firstBeat' ? 'high' : 'medium';
            console.warn('使用默认音效类型:', soundType);
        }
        
        // 获取对应的缓冲区
        const buffer = soundBuffers[soundType] || soundBufferCache.get(soundType);
        if (!buffer) {
            handleAudioError(new Error(`未找到音效: ${soundType}`), { context: '查找音效资源' });
            return false;
        }
        
        // 检查音频上下文状态
        if (scheduler.audioContext.state === 'suspended') {
            scheduler.audioContext.resume().catch(() => {});
        }
        
        // 创建音频源和增益节点
        const source = scheduler.audioContext.createBufferSource();
        const gainNode = scheduler.audioContext.createGain();
        
        source.buffer = buffer;
        
        // ✅ 修复：音量限制
        const safeVolume = Math.max(0, Math.min(0.9, volume));
        
        // ✅ 修复：获取实际音效持续时间
        const actualDuration = getActualSoundDuration(soundType);
        
        // ✅ 修复：确保 time 是绝对时间
        const currentTime = scheduler.audioContext.currentTime;
        const startTime = Math.max(time, currentTime);
        
        // ✅ 修复：根据音效时长动态调整淡入淡出
        const fadeInTime = Math.min(0.002, actualDuration * 0.1);   // 最多2ms或10%时长
        const fadeOutTime = Math.min(0.003, actualDuration * 0.15);  // 最多3ms或15%时长
        
        // ✅ 修复：确保淡入淡出不重叠
        const totalFadeTime = fadeInTime + fadeOutTime;
        let adjustedFadeIn = fadeInTime;
        let adjustedFadeOut = fadeOutTime;
        
        if (totalFadeTime > actualDuration * 0.8) {
            // 如果淡入淡出时间超过80%，按比例缩减
            const scale = (actualDuration * 0.8) / totalFadeTime;
            adjustedFadeIn = fadeInTime * scale;
            adjustedFadeOut = fadeOutTime * scale;
        }
        
        const sustainTime = Math.max(0, actualDuration - adjustedFadeIn - adjustedFadeOut);
        
        // ✅ 修复：正确设置音频包络（使用绝对时间）
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(safeVolume, startTime + adjustedFadeIn);
        
        if (sustainTime > 0.001) {  // 至少1ms的持续时间
            gainNode.gain.setValueAtTime(safeVolume, startTime + adjustedFadeIn + sustainTime);
            gainNode.gain.linearRampToValueAtTime(0, startTime + actualDuration);
        } else {
            // 时间太短，直接从峰值淡出
            gainNode.gain.linearRampToValueAtTime(0, startTime + adjustedFadeIn + adjustedFadeOut);
        }
        
        // 连接节点
        source.connect(gainNode);
        gainNode.connect(scheduler.audioContext.destination);
        
        // 生成唯一ID用于跟踪
        const nodeId = `audio-node-${Date.now()}-${nodeCounter++}`;
        activeAudioNodes.set(nodeId, { 
            source, 
            gainNode,
            createdAt: Date.now()
        });
        
        // 设置自动清理
        source.onended = () => {
            try {
                source.disconnect();
                gainNode.disconnect();
                activeAudioNodes.delete(nodeId);
            } catch (e) {
                // 忽略清理错误
            }
        };
        
        // 错误处理
        source.onerror = (error) => {
            handleAudioError(error, { context: `播放音效: ${soundType}` });
            try {
                activeAudioNodes.delete(nodeId);
            } catch (e) {}
        };
        
        // ✅ 修复：安全的超时清理
        const cleanupDelay = Math.max(100, actualDuration * 1000 + 50);
        setTimeout(() => {
            try {
                if (activeAudioNodes.has(nodeId)) {
                    const { source, gainNode } = activeAudioNodes.get(nodeId);
                    try {
                        source.stop();
                    } catch (e) {
                        // 可能已经停止
                    }
                    source.disconnect();
                    gainNode.disconnect();
                    activeAudioNodes.delete(nodeId);
                }
            } catch (e) {
                // 忽略超时清理错误
            }
        }, cleanupDelay);
        
        // 确保定期清理定时器已启动
        if (!cleanupTimerId) {
            startPeriodicCleanup();
        }
        
        // ✅ 修复：使用正确的绝对时间播放
        source.start(startTime);
        
        // 更新性能统计
        performanceStats.totalPlays++;
        performanceStats.successfulPlays++;
        performanceStats.lastPlayTime = performance.now() - perfStartTime;
        performanceStats.averagePlayTime = (
            performanceStats.averagePlayTime * (performanceStats.totalPlays - 1) +
            performanceStats.lastPlayTime
        ) / performanceStats.totalPlays;
        
        // 性能监控
        if (performanceStats.lastPlayTime > 5) {
            console.warn(`音效播放处理时间较长: ${performanceStats.lastPlayTime.toFixed(2)}ms`);
        }
        
        return true;
    } catch (error) {
        performanceStats.totalPlays++;
        performanceStats.failedPlays++;
        handleAudioError(error, { context: '播放音效' });
        return false;
    }
}


/**
 * 播放音效
 * @param {Object} options - 播放选项
 * @param {string} options.type - 音效类型 ('firstBeat' 或 'regularBeat')
 * @param {number} options.time - 播放时间（相对于音频上下文）
 * @param {number} options.volume - 音量 (0-1)
 * @returns {boolean} 是否播放成功
 * 
 * @example
 * // 播放第一拍音效
 * playSound({
 *   type: 'firstBeat',
 *   time: audioContext.currentTime,
 *   volume: 0.7
 * });
 */
export function playSound(options) {
    // 直接调用，不使用节流
    return playSoundInternal(options);
}

/**
 * 启动定期清理机制
 * @private
 */
function startPeriodicCleanup() {
    if (cleanupTimerId) {
        clearInterval(cleanupTimerId);
    }
    
    cleanupTimerId = setInterval(() => {
        cleanupExpiredNodes();
        
        // 如果没有活跃节点，停止定时器
        if (activeAudioNodes.size === 0) {
            stopPeriodicCleanup();
        }
    }, 1000); // 每秒检查一次
}

/**
 * 停止定期清理机制
 * @private
 */
function stopPeriodicCleanup() {
    if (cleanupTimerId) {
        clearInterval(cleanupTimerId);
        cleanupTimerId = null;
    }
}

/**
 * 清理过期的音频节点
 * @private
 */
function cleanupExpiredNodes() {
    const now = Date.now();
    
    for (const [nodeId, nodeInfo] of activeAudioNodes.entries()) {
        if (now - nodeInfo.createdAt > MAX_NODE_LIFETIME) {
            try {
                const { source, gainNode } = nodeInfo;
                if (scheduler && scheduler.audioContext) {
                    gainNode.gain.setValueAtTime(0, scheduler.audioContext.currentTime);
                }
                source.disconnect();
                gainNode.disconnect();
                activeAudioNodes.delete(nodeId);
            } catch (e) {
                // 忽略单个节点的清理错误
                activeAudioNodes.delete(nodeId);
            }
        }
    }
}

/**
 * 生成高音点击音效
 * @param {Float32Array} data - 音频数据数组
 * @param {number} sampleRate - 采样率
 * @param {number} bufferSize - 缓冲区大小
 * @private
 */
/**
 * 生成高音点击音效
 * @param {Float32Array} data - 音频数据数组
 * @param {number} sampleRate - 采样率
 * @param {number} bufferSize - 缓冲区大小
 * @private
 */
function generateHighClick(data, sampleRate, bufferSize) {
    // 添加输入验证
    if (!data || !ArrayBuffer.isView(data) || typeof sampleRate !== 'number' || typeof bufferSize !== 'number') {
        throw new Error('无效的音频生成参数');
    }
    
    const frequency = 800; // 频率
    const duration = 0.02; // 持续时间（秒）
    const fadeOutDuration = 0.01; // 淡出时间（秒）
    
    const durationSamples = Math.min(Math.floor(duration * sampleRate), bufferSize);
    const fadeOutSamples = Math.floor(fadeOutDuration * sampleRate);
    
    // 预计算常量以提高性能
    const twoPiF = 2 * Math.PI * frequency;
    const sampleRateInv = 1 / sampleRate;
    
    // 优化循环性能：预先计算边界
    const fadeStartIndex = durationSamples - fadeOutSamples;
    
    for (let i = 0; i < durationSamples; i++) {
        const t = i * sampleRateInv;
        // 生成正弦波
        const amplitude = i < fadeStartIndex 
            ? 1.0 
            : 1.0 - (i - fadeStartIndex) / fadeOutSamples;
        
        // 添加软限幅，防止数值溢出
        const rawValue = amplitude * Math.sin(twoPiF * t);
        data[i] = Math.max(-1, Math.min(1, rawValue));
    }
    
    // 填充剩余缓冲区为静音
    for (let i = durationSamples; i < bufferSize; i++) {
        data[i] = 0;
    }
}

/**
 * 生成低音点击音效
 * @param {Float32Array} data - 音频数据数组
 * @param {number} sampleRate - 采样率
 * @param {number} bufferSize - 缓冲区大小
 * @private
 */
function generateLowClick(data, sampleRate, bufferSize) {
    // 参数验证
    if (!data || !ArrayBuffer.isView(data) || typeof sampleRate !== 'number' || typeof bufferSize !== 'number') {
        throw new Error('无效的音频生成参数');
    }
    
    const frequency = 400; // 频率
    const duration = 0.03; // 持续时间（秒）
    const fadeOutDuration = 0.015; // 淡出时间（秒）
    
    const durationSamples = Math.min(Math.floor(duration * sampleRate), bufferSize);
    const fadeOutSamples = Math.floor(fadeOutDuration * sampleRate);
    
    // 预计算常量
    const twoPiF = 2 * Math.PI * frequency;
    const sampleRateInv = 1 / sampleRate;
    const fadeStartIndex = durationSamples - fadeOutSamples;
    
    for (let i = 0; i < durationSamples; i++) {
        const t = i * sampleRateInv;
        // 生成带衰减的正弦波
        const expAttenuation = Math.exp(-t * 50); // 快速衰减
        const amplitude = i < fadeStartIndex 
            ? expAttenuation
            : expAttenuation * (1.0 - (i - fadeStartIndex) / fadeOutSamples);
        
        // 添加软限幅
        const rawValue = amplitude * Math.sin(twoPiF * t);
        data[i] = Math.max(-1, Math.min(1, rawValue));
    }
    
    // 填充剩余缓冲区为静音
    for (let i = durationSamples; i < bufferSize; i++) {
        data[i] = 0;
    }
}

/**
 * 生成中等音调的点击音效
 * @param {Float32Array} data - 音频数据数组
 * @param {number} sampleRate - 采样率
 * @param {number} bufferSize - 缓冲区大小
 * @private
 */
function generateMediumClick(data, sampleRate, bufferSize) {
    // 参数验证
    if (!data || !ArrayBuffer.isView(data) || typeof sampleRate !== 'number' || typeof bufferSize !== 'number') {
        throw new Error('无效的音频生成参数');
    }
    
    const frequency = 600; // 频率
    const duration = 0.025; // 持续时间（秒）
    
    const durationSamples = Math.min(Math.floor(duration * sampleRate), bufferSize);
    
    // 预计算常量
    const twoPiF = 2 * Math.PI * frequency;
    const sampleRateInv = 1 / sampleRate;
    
    for (let i = 0; i < durationSamples; i++) {
        const t = i * sampleRateInv;
        const amplitude = Math.exp(-t * 40); // 指数衰减
        
        // 添加软限幅
        const rawValue = amplitude * Math.sin(twoPiF * t);
        data[i] = Math.max(-1, Math.min(1, rawValue));
    }
    
    // 填充剩余缓冲区为静音
    for (let i = durationSamples; i < bufferSize; i++) {
        data[i] = 0;
    }
}

/**
 * 生成标准点击音效
 * @param {Float32Array} data - 音频数据数组
 * @param {number} sampleRate - 采样率
 * @param {number} bufferSize - 缓冲区大小
 * @private
 */
function generateClickSound(data, sampleRate, bufferSize) {
    // 参数验证
    if (!data || !ArrayBuffer.isView(data) || typeof sampleRate !== 'number' || typeof bufferSize !== 'number') {
        throw new Error('无效的音频生成参数');
    }
    
    // 生成一个短促的噪声点击
    const duration = 0.01; // 持续时间（秒）
    const durationSamples = Math.min(Math.floor(duration * sampleRate), bufferSize);
    const decayFactor = 1 / (durationSamples * 0.5);
    
    // 优化性能：预计算衰减因子
    for (let i = 0; i < durationSamples; i++) {
        // 使用白噪声并添加衰减包络
        const noise = (Math.random() * 2 - 1);
        const envelope = Math.exp(-i * decayFactor);
        // 添加软限幅
        data[i] = Math.max(-1, Math.min(1, noise * envelope));
    }
    
    // 填充剩余缓冲区为静音
    for (let i = durationSamples; i < bufferSize; i++) {
        data[i] = 0;
    }
}

/**
 * 生成蜂鸣音效
 * @param {Float32Array} data - 音频数据数组
 * @param {number} sampleRate - 采样率
 * @param {number} bufferSize - 缓冲区大小
 * @private
 */
function generateBeepSound(data, sampleRate, bufferSize) {
    // 参数验证
    if (!data || !ArrayBuffer.isView(data) || typeof sampleRate !== 'number' || typeof bufferSize !== 'number') {
        throw new Error('无效的音频生成参数');
    }
    
    const frequency = 1000; // 频率
    const duration = 0.05; // 持续时间（秒）
    const releasePoint = 0.03; // 释音起始时间
    
    const durationSamples = Math.min(Math.floor(duration * sampleRate), bufferSize);
    
    // 预计算常量
    const twoPiF = 2 * Math.PI * frequency;
    const sampleRateInv = 1 / sampleRate;
    
    for (let i = 0; i < durationSamples; i++) {
        const t = i * sampleRateInv;
        // 生成带包络的正弦波
        const attack = Math.min(t * 50, 1); // 快速起音
        const release = t >= releasePoint ? Math.max(1 - (t - releasePoint) * 100, 0) : 1; // 快速释音
        const amplitude = attack * release;
        
        // 添加软限幅
        const rawValue = amplitude * Math.sin(twoPiF * t);
        data[i] = Math.max(-1, Math.min(1, rawValue));
    }
    
    // 填充剩余缓冲区为静音
    for (let i = durationSamples; i < bufferSize; i++) {
        data[i] = 0;
    }
}

/**
 * 切换音效类型
 * @param {string} beatType - 节拍类型 ('firstBeat' 或 'regularBeat')
 * @param {string} soundType - 音效类型
 * @returns {boolean} 是否切换成功
 * 
 * @example
 * // 切换第一拍音效为beep
 * changeSoundType('firstBeat', 'beep');
 */
/**
 * 切换音效类型
 * @param {string} beatType - 节拍类型 ('firstBeat' 或 'regularBeat')
 * @param {string} soundType - 音效类型
 * @returns {boolean} 是否切换成功
 * 
 * @example
 * // 切换第一拍音效为beep
 * changeSoundType('firstBeat', 'beep');
 */
export function changeSoundType(beatType, soundType) {
    try {
        // 输入验证
        if (typeof beatType !== 'string' || typeof soundType !== 'string') {
            throw new Error('无效的参数类型');
        }
        
        // 验证节拍类型
        if (!['firstBeat', 'regularBeat'].includes(beatType)) {
            throw new Error(`无效的节拍类型: ${beatType}`);
        }
        
        // 获取可用音效列表
        let availableSounds;
        try {
            availableSounds = getConfig('sounds.availableSounds') || ['high', 'medium', 'low', 'click', 'beep'];
        } catch (error) {
            // 使用硬编码的默认列表作为后备
            availableSounds = ['high', 'medium', 'low', 'click', 'beep'];
        }
        
        // 验证音效类型 - 更严格的检查
        if (!availableSounds.includes(soundType) && 
            !soundBuffers[soundType] && 
            !soundBufferCache.has(soundType)) {
            throw new Error(`不支持的音效类型: ${soundType}`);
        }
        
        // 缓存旧音效类型
        const oldSoundType = beatType === 'firstBeat' 
            ? getConfig('sounds.firstBeatSound') 
            : getConfig('sounds.regularBeatSound');
        
        // 更新配置
        try {
            const soundsConfig = getConfig('sounds') || {};
            if (beatType === 'firstBeat') {
                soundsConfig.firstBeatSound = soundType;
            } else if (beatType === 'regularBeat') {
                soundsConfig.regularBeatSound = soundType;
            }
        } catch (configError) {
            handleAudioError(configError, { context: '更新音效配置' });
            // 即使配置更新失败，也返回成功，因为功能不受影响
            console.warn('音效切换成功，但配置更新失败');
        }
        
        console.log(`音效类型已切换: ${beatType} -> ${soundType}`);
        
        // 触发音效变更事件
        window.dispatchEvent(new CustomEvent('audio:soundChanged', {
            detail: {
                beatType,
                oldSoundType,
                newSoundType: soundType
            }
        }));
        
        return true;
    } catch (error) {
        handleAudioError(error, { context: '切换音效类型' });
        return false;
    }
}

/**
 * 清理所有音频资源
 * @function cleanupAudioResources
 * @returns {void}
 */
export function cleanupAudioResources() {
    try {
        // 停止定期清理定时器
        stopPeriodicCleanup();
        
        // 清理活跃的音频节点
        const nodesToClean = Array.from(activeAudioNodes.entries());
        activeAudioNodes.clear();
        
        // 批量清理节点，减少错误影响
        nodesToClean.forEach(([nodeId, { source, gainNode }]) => {
            try {
                if (scheduler && scheduler.audioContext && scheduler.audioContext.state !== 'closed') {
                    gainNode.gain.setValueAtTime(0, scheduler.audioContext.currentTime);
                }
                source.disconnect();
                gainNode.disconnect();
            } catch (e) {
                // 忽略单个节点的清理错误
            }
        });
        
        // 清理缓存和存储
        soundBufferCache.clear();
        Object.keys(soundBuffers).forEach(key => {
            delete soundBuffers[key];
        });
        
        // 重置状态
        initialized = false;
        initInProgress = false;
        
        // 重置统计数据
        Object.keys(performanceStats).forEach(key => {
            performanceStats[key] = 0;
        });
        
        // 重置加载状态
        loadingState.isLoading = false;
        loadingState.loadedCount = 0;
        loadingState.totalCount = 0;
        loadingState.loadStartTime = 0;
        
        console.log('音频资源已清理');
        
        // 触发清理完成事件
        window.dispatchEvent(new CustomEvent('audio:cleanupComplete'));
    } catch (error) {
        handleAudioError(error, { context: '清理音频资源' });
    }
}

/**
 * 检查音频系统是否准备就绪
 * @function isAudioReady
 * @returns {boolean} 音频系统是否就绪
 */
export function isAudioReady() {
    return initialized && 
           scheduler?.audioContext && 
           scheduler.audioContext.state !== 'closed' &&
           Object.keys(soundBuffers).length > 0;
}

/**
 * 获取音频加载状态
 * @returns {Object} 加载状态信息
 */
export function getAudioLoadingState() {
    return {
        isLoading: loadingState.isLoading,
        loadedCount: loadingState.loadedCount,
        totalCount: loadingState.totalCount,
        progress: loadingState.totalCount > 0 ? 
            (loadingState.loadedCount / loadingState.totalCount) * 100 : 0
    };
}

/**
 * 获取音频性能统计
 * @returns {Object} 性能统计信息
 */
export function getAudioPerformanceStats() {
    return { ...performanceStats };
}

/**
 * 获取当前活跃的音频节点数量
 * @returns {number} 活跃节点数量
 */
export function getActiveNodeCount() {
    return activeAudioNodes.size;
}

/**
 * 获取可用的音效类型列表
 * @returns {Array<string>} 音效类型列表
 */
export function getAvailableSoundTypes() {
    return Object.keys(soundBuffers);
}

/**
 * 尝试验证音效是否可用
 * @param {string} soundType - 音效类型
 * @returns {boolean} 音效是否可用
 */
export function isSoundAvailable(soundType) {
    return soundBuffers[soundType] !== undefined || 
           soundBufferCache.has(soundType);
}

/**
 * 预加载额外的音效
 * @param {string} name - 音效名称
 * @param {Function} generator - 音频生成函数
 * @returns {Promise<boolean>} 预加载是否成功
 */
export async function preloadSound(name, generator) {
    try {
        if (!initialized || !scheduler || !scheduler.audioContext) {
            throw new Error('音频系统未初始化');
        }
        
        await createSoundBuffer(name, generator);
        return true;
    } catch (error) {
        handleAudioError(error, { context: `预加载音效: ${name}` });
        return false;
    }
}