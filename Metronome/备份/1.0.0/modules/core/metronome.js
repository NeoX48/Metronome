/**
 * 节拍器核心模块 - 提供节拍器的主要功能
 * 
 * @module metronome
 * @description 负责节拍的生成、控制和管理，包含错误处理和性能优化
 */

import { getState, updateState } from '../utils/state.js';
import { getConfig } from '../utils/config.js';
import { playSound, isAudioReady } from '../audio/soundBuffers.js';
import { scheduler } from '../audio/scheduler.js';
import { handleAudioError, handleConfigError } from '../utils/errorManager.js';
import { debounce, throttle } from '../utils/helpers.js';

/**
 * 节拍器状态
 */
let metronomeState = {
    isInitialized: false,
    performanceStats: {
        totalBeats: 0,
        totalRuntime: 0,
        lastStartTime: 0,
        avgBeatInterval: 0
    }
};

// 防抖更新状态函数
const debouncedStateUpdate = debounce(() => {
    try {
        updateState({ metronomeState: { ...metronomeState } });
    } catch (error) {
        console.error('更新节拍器状态失败:', error);
    }
}, 30);

/**
 * 初始化节拍器
 * @returns {Promise<boolean>} 初始化是否成功
 * 
 * @example
 * // 在应用启动时初始化节拍器
 * async function initApp() {
 *   const success = await initMetronome();
 *   console.log('节拍器已初始化:', success);
 * }
 */
export async function initMetronome() {
    try {
        // 防止重复初始化
        if (metronomeState.isInitialized) {
            console.warn('节拍器已经初始化');
            return true;
        }
        
        console.log('开始初始化节拍器...');
        
        // 初始化音频上下文
        await scheduler.init();
        
        // 标记为初始化完成
        metronomeState.isInitialized = true;
        
        console.log('节拍器初始化成功');
        
        // 触发初始化成功事件
        window.dispatchEvent(new CustomEvent('metronome:initialized', {
            detail: { success: true },
            bubbles: true,
            cancelable: true
        }));
        
        return true;
    } catch (error) {
        const handledError = handleAudioError(error, { context: '初始化节拍器' });
        
        // 触发初始化失败事件
        window.dispatchEvent(new CustomEvent('metronome:initFailed', {
            detail: { error: handledError.message },
            bubbles: true,
            cancelable: true
        }));
        
        return false;
    }
}

/**
 * 开始节拍器
 * @returns {boolean} 是否成功启动
 * 
 * @example
 * // 启动节拍器
 * const started = startMetronome();
 * if (started) {
 *   console.log('节拍器已开始');
 * }
 */
export function startMetronome() {
    try {
        // 检查是否初始化
        if (!metronomeState.isInitialized) {
            throw new Error('节拍器尚未初始化');
        }
        
        // 检查音频是否就绪
        if (!isAudioReady()) {
            throw new Error('音频系统尚未就绪');
        }
        
        const state = getState();
        
        // 如果已经在运行，不执行操作
        if (state.isRunning) {
            console.warn('节拍器已经在运行中');
            return false;
        }
        
        // 重置性能统计
        metronomeState.performanceStats.totalBeats = 0;
        metronomeState.performanceStats.lastStartTime = Date.now();
        
        // 更新运行状态
        updateState({ isRunning: true });
        
        // 开始调度器
        const started = scheduler.start(scheduleBeat); // ✅ 直接传递 scheduleBeat
        if (!started) {
            throw new Error('调度器启动失败');
        }
        
        // 触发启动成功事件
        window.dispatchEvent(new CustomEvent('metronome:started', {
            detail: {
                bpm: state.bpm,
                timeSignature: {
                    numerator: state.beatNumerator,
                    denominator: state.beatDenominator
                }
            },
            bubbles: true,
            cancelable: true
        }));
        
        return true;
    } catch (error) {
        const handledError = handleAudioError(error, { context: '启动节拍器' });
        updateState({ isRunning: false });
        
        // 触发启动失败事件
        window.dispatchEvent(new CustomEvent('metronome:startFailed', {
            detail: { error: handledError.message },
            bubbles: true,
            cancelable: true
        }));
        
        return false;
    }
}

/**
 * 停止节拍器
 * @returns {boolean} 是否成功停止
 * 
 * @example
 * // 停止节拍器
 * const stopped = stopMetronome();
 * if (stopped) {
 *   console.log('节拍器已停止');
 * }
 */
export function stopMetronome() {
    try {
        const state = getState();
        
        // 如果没有在运行，不执行操作
        if (!state.isRunning) {
            console.warn('节拍器没有在运行');
            return false;
        }
        
        // 更新运行时间统计
        if (metronomeState.performanceStats.lastStartTime > 0) {
            metronomeState.performanceStats.totalRuntime += 
                Date.now() - metronomeState.performanceStats.lastStartTime;
        }
        
        // 停止调度器
        const stopped = scheduler.stop();
        if (!stopped) {
            console.warn('调度器停止可能未成功');
        }
        
        // 更新运行状态
        updateState({ 
            isRunning: false,
            currentBeat: 0,
            currentBar: 0 
        });
        
        // 触发停止事件
        window.dispatchEvent(new CustomEvent('metronome:stopped', {
            detail: {
                performanceStats: { ...metronomeState.performanceStats }
            },
            bubbles: true,
            cancelable: true
        }));
        
        return true;
    } catch (error) {
        handleAudioError(error, { context: '停止节拍器' });
        try {
            updateState({ isRunning: false });
        } catch (e) {
            console.error('无法更新状态:', e);
        }
        return false;
    }
}

/**
 * 切换节拍器运行状态
 * @returns {boolean} 切换后的运行状态
 * 
 * @example
 * // 切换节拍器状态
 * const isRunning = toggleMetronome();
 * console.log(`节拍器现在${isRunning ? '正在运行' : '已停止'}`);
 */
export function toggleMetronome() {
    try {
        const state = getState();
        
        if (state.isRunning) {
            return !stopMetronome();
        } else {
            return startMetronome();
        }
    } catch (error) {
        handleAudioError(error, { context: '切换节拍器状态' });
        return false;
    }
}

/**
 * 设置BPM（每分钟节拍数）
 * @param {number} newBPM - 新的BPM值
 * @returns {boolean} 是否设置成功
 * 
 * @example
 * // 设置BPM为120
 * const success = setBPM(120);
 * if (success) {
 *   console.log('BPM已设置为120');
 * }
 */
export function setBPM(newBPM) {
    try {
        const minBPM = getConfig('minBPM');
        const maxBPM = getConfig('maxBPM');
        
        // 验证BPM值是否在有效范围内
        if (typeof newBPM !== 'number' || newBPM < minBPM || newBPM > maxBPM) {
            throw new Error(`BPM必须在${minBPM}到${maxBPM}之间`);
        }
        
        // 限制BPM的精度
        const clampedBPM = Math.round(newBPM * 10) / 10;
        const state = getState();
        
        // 如果值相同，不做任何操作
        if (Math.abs(state.bpm - clampedBPM) < 0.1) {
            return true;
        }
        
        // 更新BPM
        updateState({ bpm: clampedBPM });
        
        // 如果节拍器正在运行，更新调度器的间隔
        if (state.isRunning) {
            const updateSuccess = scheduler.updateInterval();
            if (!updateSuccess) {
                console.warn('更新调度器间隔失败');
            }
        }
        
        // 触发BPM变更事件
        window.dispatchEvent(new CustomEvent('metronome:bpmChanged', {
            detail: { bpm: clampedBPM },
            bubbles: true,
            cancelable: true
        }));
        
        return true;
    } catch (error) {
        handleConfigError(error, { context: '设置BPM' });
        return false;
    }
}

/**
 * 获取当前BPM
 * @returns {number} 当前的BPM值
 * 
 * @example
 * // 获取当前BPM
 * const currentBPM = getBPM();
 * console.log(`当前BPM: ${currentBPM}`);
 */
export function getBPM() {
    return getState().bpm;
}

/**
 * 设置拍号
 * @param {number} numerator - 拍号分子
 * @param {number} denominator - 拍号分母
 * @returns {boolean} 是否设置成功
 * 
 * @example
 * // 设置拍号为3/4
 * const success = setTimeSignature(3, 4);
 * if (success) {
 *   console.log('拍号已设置为3/4');
 * }
 */
export function setTimeSignature(numerator, denominator) {
    try {
        const minNumerator = getConfig('minBeatNumerator');
        const maxNumerator = getConfig('maxBeatNumerator');
        const validDenominators = getConfig('validDenominators');
        
        // 验证拍号值
        if (typeof numerator !== 'number' || numerator < minNumerator || numerator > maxNumerator) {
            throw new Error(`拍号分子必须在${minNumerator}到${maxNumerator}之间`);
        }
        
        if (!validDenominators.includes(denominator)) {
            throw new Error(`无效的拍号分母，有效值为: ${validDenominators.join(', ')}`);
        }
        
        const state = getState();
        
        // 如果拍号相同，不做任何操作
        if (state.beatNumerator === numerator && state.beatDenominator === denominator) {
            return true;
        }
        
        // 更新拍号
        updateState({
            beatNumerator: numerator,
            beatDenominator: denominator,
            currentBeat: 0,
            currentBar: 0
        });
        
        // 如果节拍器正在运行，更新调度器
        if (state.isRunning) {
            scheduler.updateInterval();
        }
        
        // 触发拍号变更事件
        window.dispatchEvent(new CustomEvent('metronome:timeSignatureChanged', {
            detail: { 
                numerator: numerator, 
                denominator: denominator 
            },
            bubbles: true,
            cancelable: true
        }));
        
        return true;
    } catch (error) {
        handleConfigError(error, { context: '设置拍号' });
        return false;
    }
}

/**
 * 设置音量
 * @param {number} newVolume - 新的音量值 (0-100)
 * @returns {boolean} 是否设置成功
 * 
 * @example
 * // 设置音量为75%
 * const success = setVolume(75);
 * if (success) {
 *   console.log('音量已设置为75%');
 * }
 */
export function setVolume(newVolume) {
    try {
        const minVolume = getConfig('minVolume');
        const maxVolume = getConfig('maxVolume');
        
        // 验证音量值
        if (typeof newVolume !== 'number' || newVolume < minVolume || newVolume > maxVolume) {
            throw new Error(`音量必须在${minVolume}到${maxVolume}之间`);
        }
        
        // 限制音量精度
        const clampedVolume = Math.round(newVolume);
        
        // 如果值相同，不做任何操作
        if (getState().volume === clampedVolume) {
            return true;
        }
        
        // 更新音量
        updateState({ volume: clampedVolume });
        
        // 触发音量变更事件
        window.dispatchEvent(new CustomEvent('metronome:volumeChanged', {
            detail: { volume: clampedVolume },
            bubbles: true,
            cancelable: true
        }));
        
        return true;
    } catch (error) {
        handleConfigError(error, { context: '设置音量' });
        return false;
    }
}

/**
 * 节拍调度函数
 * @param {number} beatTime - 节拍时间
 * @param {number} beatNumber - 节拍编号
 * @private
 */
function scheduleBeat(beatTime, beatNumber) {
    try {
        const state = getState();
        const isFirstBeat = beatNumber === 1;
        
        // 更新性能统计
        metronomeState.performanceStats.totalBeats++;
        
        // 播放对应的音效
        const playSuccess = playSound({
            type: isFirstBeat ? 'firstBeat' : 'regularBeat',
            time: beatTime,
            volume: state.volume / 100
        });
        
        if (!playSuccess) {
            console.warn('播放声音失败');
            // 不进行错时补放，记录失败即可，避免节拍网格被破坏
        }
        
        // 更新当前节拍和小节
        const newBeat = beatNumber;
        const newBar = Math.floor((beatNumber - 1) / state.beatNumerator);
        
        // 使用防抖更新状态
        updateState({
            currentBeat: newBeat,
            currentBar: newBar
        });
        
        // 计算平均节拍间隔
        if (metronomeState.performanceStats.totalBeats > 1) {
            const expectedInterval = 60000 / state.bpm;
            metronomeState.performanceStats.avgBeatInterval = expectedInterval;
        }
        
        // 触发自定义事件
        const event = new CustomEvent('metronome:beat', {
            detail: {
                beat: newBeat,
                bar: newBar,
                isFirstBeat: isFirstBeat,
                bpm: state.bpm,
                performanceStats: { ...metronomeState.performanceStats }
            },
            bubbles: true,
            cancelable: true
        });
        window.dispatchEvent(event);
        
    } catch (error) {
        handleAudioError(error, { context: '调度节拍' });
    }
}

/**
 * 恢复节拍器状态（用于错误恢复）
 * @returns {boolean} 恢复是否成功
 */
export function attemptRecovery() {
    try {
        console.log('尝试恢复节拍器状态...');
        
        // 停止当前可能运行的实例
        stopMetronome();
        
        // 重置状态
        updateState({
            currentBeat: 0,
            currentBar: 0,
            isRunning: false
        });
        
        // 重置性能统计
        metronomeState.performanceStats = {
            totalBeats: 0,
            totalRuntime: 0,
            lastStartTime: 0,
            avgBeatInterval: 0
        };
        
        // 触发恢复事件
        window.dispatchEvent(new CustomEvent('metronome:recovered', {
            bubbles: true,
            cancelable: true
        }));
        
        console.log('节拍器状态已恢复');
        return true;
    } catch (error) {
        handleAudioError(error, { context: '恢复节拍器状态' });
        return false;
    }
}

/**
 * 清理节拍器资源
 * @returns {boolean} 清理是否成功
 */
export function resetMetronome() {
    try {
        // 停止节拍器
        stopMetronome();
        
        // 重置状态
        metronomeState = {
            isInitialized: false,
            performanceStats: {
                totalBeats: 0,
                totalRuntime: 0,
                lastStartTime: 0,
                avgBeatInterval: 0
            }
        };
        
        console.log('节拍器资源已清理');
        return true;
    } catch (error) {
        handleAudioError(error, { context: '清理节拍器资源' });
        return false;
    }
}

/**
 * 获取当前性能统计信息
 * @returns {Object} 性能统计信息
 */
export function getPerformanceStats() {
    return { ...metronomeState.performanceStats };
}

/**
 * 检查节拍器是否初始化
 * @returns {boolean} 是否已初始化
 */
export function isInitialized() {
    return metronomeState.isInitialized;
}

// 不需要额外的别名导出，函数已直接命名为resetMetronome