/**
 * 节拍器核心模块
 * 
 * @file metronome.js
 * @description 提供节拍器的核心功能实现
 */

// 导入依赖
import { getConfig } from '../../modules/utils/config.js';
import { getState, updateState } from '../../modules/utils/state.js';
import { handleAudioError } from '../../modules/utils/errorManager.js';
import { scheduler } from '../../modules/audio/scheduler.js';

// 限制数值在指定范围内的辅助函数
function clamp(value, min, max) {
    return Math.min(Math.max(Number(value) || 0, min), max);
}

/**
 * 节拍器实例
 * @private
 */
let metronomeInstance = null;

/**
 * 节拍器类
 * @private
 */
class Metronome {
    constructor() {
        // 初始化属性，但不设置为已初始化
        this.audioContext = null;
        this.initialized = false;
        this.isPlaying = false;
        this.currentTime = 0;
        this.schedulerInterval = null;
        
        // 节拍参数
        this.bpm = getConfig('defaultBpm') || 120;
        this.volume = getConfig('defaultVolume') || 0.7;
        this.beatNumerator = getConfig('defaultBeatNumerator') || 4;
        this.beatDenominator = getConfig('defaultBeatDenominator') || 4;
        
        // 调度状态
        this.nextBeatTime = 0;
        this.currentBeat = 0;
        
        // 节点池用于优化性能
        this.nodePool = {
            oscillators: [],
            gains: []
        };
        
        // 音色配置
        this.toneConfig = {
            click: { frequency: 800, duration: 0.05 },
            accent: { frequency: 1200, duration: 0.07 }
        };
        
        // 新增节点池
        this.nodePool = {
            oscillators: [],
            gains: []
        };
    }

    /**
     * 初始化节拍器
     * @async
     */
    async initialize() {
        try {
            // 防止重复初始化
            if (this.initialized) {
                console.warn('节拍器已经初始化');
                return;
            }

            // 确保使用scheduler的音频上下文
            this.audioContext = scheduler.audioContext;
            this.initialized = true;
            console.log('节拍器初始化成功');
        } catch (error) {
            console.error('初始化节拍器失败:', error);
            throw error;
        }
    }

    /**
     * 开始节拍器
     */
    async start() {
        try {
            // 确保已初始化
            if (!this.initialized) {
                await this.initialize();
            }
            
            this.isPlaying = true;
            
            // 确保音频上下文处于活动状态
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // 重置节拍计数
            this.currentBeat = 0;
            
            // 使用外部调度器模块
            const startResult = scheduler.start((beatTime, beatNumber) => {
                this._playBeat({
                    time: beatTime,
                    isAccent: beatNumber === 1, // 第一拍为重音
                    volume: this.volume
                });
            });
            
            if (!startResult) {
                throw new Error('调度器启动失败');
            }
            
            // 更新状态
            updateState({ isPlaying: true });
            console.log('节拍器已开始');
            
            return true;
        } catch (error) {
            console.error('启动节拍器失败:', error);
            handleAudioError(error, { context: '启动节拍器' });
            this.isPlaying = false;
            return false;
        }
    }

    /**
     * 停止播放
     */
    stop() {
        try {
            if (!this.isPlaying) {
                console.warn('节拍器未在播放');
                return;
            }

            this.isPlaying = false;
            // 停止外部调度器
            scheduler.stop();
            updateState({ isPlaying: false });
            console.log('节拍器已停止');
        } catch (error) {
            console.error('停止节拍器失败:', error);
            throw error;
        }
    }

    /**
     * 切换播放状态
     */
    async toggle() {
        try {
            if (this.isPlaying) {
                this.stop();
            } else {
                await this.start();
            }
            return this.isPlaying;
        } catch (error) {
            console.error('切换节拍器状态失败:', error);
            throw error;
        }
    }

    /**
     * 设置BPM
     * @param {number} bpm - 每分钟节拍数
     */
    setBPM(bpm) {
        // 确保BPM在有效范围内
        const minBPM = getConfig('minBPM') || 40;
        const maxBPM = getConfig('maxBPM') || 208;
        this.bpm = clamp(bpm, minBPM, maxBPM);
        
        // 更新全局状态
        updateState({ bpm: this.bpm });
        console.log('BPM已设置为:', this.bpm);
    }

    /**
     * 设置音量
     * @param {number} volume - 音量值 (0-100)
     */
    setVolume(volume) {
        // 确保音量值在0-100范围内
        this.volume = Math.max(0, Math.min(100, volume));
        updateState({ volume: this.volume });
        console.log('音量已设置为:', this.volume + '%');
    }
    
    /**
     * 设置拍号
     * @param {number} numerator - 分子
     * @param {number} denominator - 分母
     */
    setTimeSignature(numerator, denominator) {
        this.beatNumerator = Math.max(1, Math.min(16, numerator));
        this.beatDenominator = Math.pow(2, Math.round(Math.log2(Math.max(1, Math.min(16, denominator)))));
        
        updateState({
            beatNumerator: this.beatNumerator,
            beatDenominator: this.beatDenominator
        });
        
        console.log('拍号已设置为:', `${this.beatNumerator}/${this.beatDenominator}`);
    }

    /**
     * 获取每拍的时长（秒）
     * @returns {number}
     */
    _getSecondsPerBeat() {
        return 60 / this.bpm;
    }
    
    /**
     * 初始化节拍器时确保调度器也已初始化
     */
    async initialize() {
        if (this.initialized) {
            console.warn('节拍器已经初始化');
            return this;
        }
        
        try {
            // 首先初始化外部调度器
            if (!scheduler.isInitialized()) {
                await scheduler.init();
            }
            
            // 使用scheduler的音频上下文
            this.audioContext = scheduler.audioContext;
            if (!this.audioContext) {
                throw new Error('无法获取音频上下文');
            }
            
            // 初始化节拍参数
            const initialState = getState();
            this.bpm = initialState.bpm || this.bpm;
            this.volume = initialState.volume || this.volume;
            this.beatNumerator = initialState.beatNumerator || this.beatNumerator;
            this.beatDenominator = initialState.beatDenominator || this.beatDenominator;
            
            this.initialized = true;
            console.log('节拍器初始化成功');
            return this;
        } catch (error) {
            console.error('节拍器初始化失败:', error);
            handleAudioError(error, { context: '初始化节拍器' });
            throw error;
        }
    }

    /**
     * 播放单个节拍声音
     * @param {object} beatParams - 节拍参数对象
     * @private
     */
    _playBeat(beatParams) {
        try {
            // 参数校验
            if (typeof beatParams.volume !== 'number') {
                throw new Error('Invalid volume parameter');
            }
            
            // 将百分比音量（0-100）转换为音频增益值（0-1），然后安全限定
            const audioVolume = beatParams.volume / 100;
            const safeVolume = clamp(
                audioVolume,
                0,  // 最小音量
                1   // 最大音量
            );
            
            // 添加调试日志
            console.debug('[节拍播放]', {
                originalVolume: beatParams.volume,
                clampedVolume: safeVolume,
                timestamp: performance.now()
            });
            
            const { time, isAccent } = beatParams;
            const tone = isAccent ? this.toneConfig.accent : this.toneConfig.click;
            
            // 使用可复用的节点
            const oscillator = this._getReusableNode('oscillators', 'OscillatorNode');
            const gainNode = this._getReusableNode('gains', 'GainNode');
            
            // 连接节点
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // 设置参数
            oscillator.frequency.value = tone.frequency;
            oscillator.type = 'square';
            
            // 直接使用安全限定后的音量
            
            // 设置音量包络
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(safeVolume * 0.5, time + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, time + tone.duration);
            
            // 播放
            oscillator.start(time);
            oscillator.stop(time + tone.duration + 0.01);
            
            // 安排节点复用
            setTimeout(() => {
                try {
                    // 断开连接以便复用
                    oscillator.disconnect();
                    gainNode.disconnect();
                    
                    // 重置增益
                    gainNode.gain.value = 0;
                } catch (e) {
                    // 忽略可能的错误，如节点已停止
                }
            }, (tone.duration + 0.1) * 1000);
            
            // 更新当前节拍状态
            updateState({
                currentBeat: this.currentBeat + 1,
                currentBar: Math.floor(this.nextBeatTime / (this._getSecondsPerBeat() * this.beatNumerator))
            });
            
        } catch (error) {
            console.error('播放节拍失败:', error);
        }
    }
    
    // 新增节点复用逻辑
    _getReusableNode(poolType, nodeType) {
        const pool = this.nodePool[poolType];
        
        // 尝试从池中获取可用节点
        // 注意：振荡器节点停止后不能重新开始，所以需要创建新的
        if (nodeType === 'OscillatorNode') {
            // 对于振荡器，我们总是创建新的节点
            const newNode = this.audioContext.createOscillator();
            pool.push(newNode);
            return newNode;
        } else if (nodeType === 'GainNode') {
            // 对于增益节点，我们可以复用
            const availableNode = pool.find(n => n.numberOfInputs > 0); // 简单检查节点是否可用
            
            if (availableNode) {
                return availableNode;
            }
            
            const newNode = this.audioContext.createGain();
            pool.push(newNode);
            return newNode;
        }
        
        // 默认创建新节点
        if (nodeType === 'OscillatorNode') {
            return this.audioContext.createOscillator();
        } else if (nodeType === 'GainNode') {
            return this.audioContext.createGain();
        }
        throw new Error(`Unsupported node type: ${nodeType}`);
    }

    /**
     * 销毁节拍器
     */
    destroy() {
        try {
            this.stop();
            
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }
            
            this.initialized = false;
            console.log('节拍器已销毁');
        } catch (error) {
            console.error('销毁节拍器失败:', error);
        }
    }
}

/**
 * 初始化节拍器
 * @returns {Promise<Metronome>} 节拍器实例
 */
export async function initMetronome() {
    if (!metronomeInstance) {
        metronomeInstance = new Metronome();
    }
    // 确保节拍器已初始化
    if (!metronomeInstance.initialized) {
        await metronomeInstance.initialize();
    }
    return metronomeInstance;
}

/**
 * 获取节拍器实例
 * @returns {Metronome|null} 节拍器实例
 */
export function getMetronome() {
    return metronomeInstance;
}

/**
 * 获取节拍器实例（兼容旧API）
 * @returns {Metronome|null} 节拍器实例
 */
export function getGlobalMetronome() {
    console.warn('getGlobalMetronome已弃用，请使用getMetronome');
    return getMetronome();
}

/**
 * 设置节拍器的BPM值
 * @param {number} bpm - 每分钟节拍数
 */
export function setBPM(bpm) {
    if (metronomeInstance) {
        return metronomeInstance.setBPM(bpm);
    }
    console.warn('节拍器未初始化，无法设置BPM');
    return false;
}

/**
 * 设置节拍器的拍号
 * @param {number} numerator - 拍号分子
 * @param {number} denominator - 拍号分母
 */
export function setTimeSignature(numerator, denominator) {
    if (metronomeInstance) {
        return metronomeInstance.setTimeSignature(numerator, denominator);
    }
    console.warn('节拍器未初始化，无法设置拍号');
    return false;
}

/**
 * 停止节拍器
 */
export function stopMetronome() {
    if (metronomeInstance) {
        return metronomeInstance.stop();
    }
    console.warn('节拍器未初始化，无法停止');
    return false;
}

/**
 * 切换节拍器播放状态
 */
export async function toggleMetronome() {
    if (metronomeInstance) {
        return await metronomeInstance.toggle();
    }
    console.warn('节拍器未初始化，无法切换状态');
    return false;
}

/**
 * 设置节拍器的音量
 * @param {number} volume - 音量值（0-1）
 */
export function setVolume(volume) {
    if (metronomeInstance) {
        return metronomeInstance.setVolume(volume);
    }
    console.warn('节拍器未初始化，无法设置音量');
    return false;
}

/**
 * 获取节拍器的当前BPM值
 * @returns {number} 当前的BPM值
 */
export function getBPM() {
    if (metronomeInstance) {
        return metronomeInstance.bpm;
    }
    console.warn('节拍器未初始化，无法获取BPM');
    return 0;
}

/**
 * 销毁节拍器实例
 */
export function destroyMetronome() {
    if (metronomeInstance) {
        metronomeInstance.destroy();
        metronomeInstance = null;
    }
}