/**
 * 训练模式UI模块 - 管理节拍器的训练功能界面
 * 
 * @module trainingUI
 * @description 处理训练模式相关的UI元素、事件绑定和状态更新
 */

import {
    getElement, 
    getElements, 
    addEventListenerSafe,
    setText,
    toggleClass,
    showElement
} from '../utils/helpers.js';
import { getState, updateState, subscribeToState } from '../utils/state.js';

/**
 * 训练模式UI控制器类
 */
class TrainingUIController {
    constructor() {
        this.initialized = false;
        this.unsubscribeState = null;
        this.activeTab = 'segments'; // 默认活动标签
        this.trainingSession = null;
    }
    
    /**
     * 初始化训练模式UI控制器
     * @returns {Promise<void>}
     * 
     * @example
     * // 初始化训练模式UI控制器
     * await trainingUIController.init();
     */
    async init() {
        try {
            if (this.initialized) {
                console.warn('训练模式UI控制器已经初始化');
                return;
            }
            
            // 绑定DOM元素
            this._bindElements();
            
            // 绑定事件监听器
            this._bindEvents();
            
            // 订阅状态变更
            this._subscribeToState();
            
            // 初始化UI
            this._initializeUI();
            
            this.initialized = true;
            console.log('训练模式UI控制器初始化成功');
        } catch (error) {
            console.error('初始化训练模式UI控制器失败:', error);
            throw new Error('无法初始化训练模式UI控制器: ' + error.message);
        }
    }
    
    /**
     * 绑定DOM元素
     * @private
     */
    _bindElements() {
        // 主容器
        this.trainingModeContainer = getElement('#training-mode');
        this.trainingTabContainer = getElement('#training-tabs');
        this.trainingContentContainer = getElement('#training-content');
        
        // 标签按钮
        this.segmentsTabBtn = getElement('#segments-tab-btn');
        this.patternsTabBtn = getElement('#patterns-tab-btn');
        this.customTabBtn = getElement('#custom-tab-btn');
        
        // 内容区域
        this.segmentsContent = getElement('#segments-content');
        this.patternsContent = getElement('#patterns-content');
        this.customContent = getElement('#custom-content');
        
        // 段落控制
        this.segmentsContainer = getElement('.segments-container');
        this.addSegmentBtn = getElement('#add-segment-btn');
        
        // 通用控制
        this.startTrainingBtn = getElement('#start-training-btn');
        this.stopTrainingBtn = getElement('#stop-training-btn');
        this.resetTrainingBtn = getElement('#reset-training-btn');
        
        // 训练状态显示
        this.trainingStatus = getElement('#training-status');
        this.currentSegment = getElement('#current-segment');
        this.remainingTime = getElement('#remaining-time');
    }
    
    /**
     * 绑定事件监听器
     * @private
     */
    _bindEvents() {
        // 标签切换事件
        if (this.segmentsTabBtn) {
            addEventListenerSafe(this.segmentsTabBtn, 'click', () => this._switchTab('segments'));
        }
        
        if (this.patternsTabBtn) {
            addEventListenerSafe(this.patternsTabBtn, 'click', () => this._switchTab('patterns'));
        }
        
        if (this.customTabBtn) {
            addEventListenerSafe(this.customTabBtn, 'click', () => this._switchTab('custom'));
        }
        
        // 段落控制事件
        if (this.addSegmentBtn) {
            addEventListenerSafe(this.addSegmentBtn, 'click', this._addSegment.bind(this));
        }
        
        // 训练控制事件
        if (this.startTrainingBtn) {
            addEventListenerSafe(this.startTrainingBtn, 'click', this._handleStartTraining.bind(this));
        }
        
        if (this.stopTrainingBtn) {
            addEventListenerSafe(this.stopTrainingBtn, 'click', this._handleStopTraining.bind(this));
        }
        
        if (this.resetTrainingBtn) {
            addEventListenerSafe(this.resetTrainingBtn, 'click', this._handleResetTraining.bind(this));
        }
        
        // 训练事件监听
        addEventListenerSafe(window, 'training:segmentChange', this._handleSegmentChange.bind(this));
        addEventListenerSafe(window, 'training:update', this._handleTrainingUpdate.bind(this));
        addEventListenerSafe(window, 'training:complete', this._handleTrainingComplete.bind(this));
    }
    
    /**
     * 订阅状态变更
     * @private
     */
    _subscribeToState() {
        this.unsubscribeState = subscribeToState((prevState, newState) => {
            this._handleStateChange(prevState, newState);
        });
    }
    
    /**
     * 处理状态变更
     * @private
     * @param {Object} prevState - 前一个状态
     * @param {Object} newState - 新的状态
     */
    _handleStateChange(prevState, newState) {
        if (prevState.isTraining !== newState.isTraining) {
            this._updateTrainingControls(newState.isTraining);
        }
        
        if (newState.isTraining) {
            this._updateTrainingStatusDisplay(newState.trainingState);
        }
    }
    
    /**
     * 初始化UI
     * @private
     */
    _initializeUI() {
        // 显示默认标签
        this._switchTab(this.activeTab);
        
        // 添加默认段落
        if (!this._hasSegments()) {
            this._addSegment();
        }
        
        // 初始化训练控制状态
        const isTraining = getState().isTraining;
        this._updateTrainingControls(isTraining);
    }
    
    /**
     * 切换标签页
     * @private
     * @param {string} tabName - 标签名称
     */
    _switchTab(tabName) {
        // 防止重复切换
        if (this.activeTab === tabName) return;
        
        this.activeTab = tabName;
        
        // 更新标签按钮状态
        this._updateTabButtons();
        
        // 更新内容显示
        this._updateTabContent();
    }
    
    /**
     * 更新标签按钮状态
     * @private
     */
    _updateTabButtons() {
        const tabs = ['segments', 'patterns', 'custom'];
        
        tabs.forEach(tab => {
            const btn = getElement(`#${tab}-tab-btn`);
            if (btn) {
                toggleClass(btn, 'active', tab === this.activeTab);
            }
        });
    }
    
    /**
     * 更新标签内容显示
     * @private
     */
    _updateTabContent() {
        const tabs = ['segments', 'patterns', 'custom'];
        
        tabs.forEach(tab => {
            const content = getElement(`#${tab}-content`);
            if (content) {
                if (tab === this.activeTab) {
                    showElement(content);
                } else {
                    content.style.display = 'none';
                }
            }
        });
    }
    
    /**
     * 检查是否已有段落
     * @private
     * @returns {boolean}
     */
    _hasSegments() {
        if (!this.segmentsContainer) return false;
        return this.segmentsContainer.querySelectorAll('.training-segment').length > 0;
    }
    
    /**
     * 添加新段落
     * @private
     */
    _addSegment() {
        if (!this.segmentsContainer) return;
        
        // 计算新段落ID
        const segmentId = 'segment-' + Date.now();
        const segmentIndex = this.segmentsContainer.querySelectorAll('.training-segment').length + 1;
        
        // 创建段落元素
        const segment = document.createElement('div');
        segment.className = 'training-segment';
        segment.id = segmentId;
        
        // 设置段落内容，根据当前段落数量决定是否显示删除按钮
        // 当段落数量小于3时，不显示删除按钮（保持至少2个段落）
        const totalSegments = this.segmentsContainer.querySelectorAll('.training-segment').length + 1;
        // 关键逻辑：只有当段落数量大于等于3时，才显示删除按钮
        const showDeleteButton = totalSegments >= 3;
        
        segment.innerHTML = `
            <div class="segment-header">
                ${showDeleteButton ? '<button type="button" class="remove-segment-btn">删除</button>' : ''}
            </div>
            <div class="segment-controls">
                <div class="control-group">
                    <label for="${segmentId}-bpm">BPM</label>
                    <input type="number" id="${segmentId}-bpm" class="segment-bpm" min="40" max="300" value="120">
                </div>
            </div>
        `;
        
        // 添加到容器
        this.segmentsContainer.appendChild(segment);
        
        // 绑定删除按钮事件
        const removeBtn = segment.querySelector('.remove-segment-btn');
        if (removeBtn) {
            addEventListenerSafe(removeBtn, 'click', () => this._removeSegment(segmentId));
        }
        
        console.log(`添加新训练段落: ${segmentId}`);
    }
    
    /**
     * 移除段落
     * @private
     * @param {string} segmentId - 段落ID
     */
    _removeSegment(segmentId) {
        // 确保至少保留两个段落
        const segments = this.segmentsContainer.querySelectorAll('.training-segment');
        if (segments.length <= 2) {
            console.log('不能删除最后两个段落');
            return;
        }
        
        const segment = getElement(`#${segmentId}`);
        if (segment && this.segmentsContainer) {
            this.segmentsContainer.removeChild(segment);
            console.log(`移除训练段落: ${segmentId}`);
            
            // 重新编号段落
            this._renumberSegments();
        }
    }
    
    /**
     * 重新编号段落并更新删除按钮显示状态
     * @private
     */
    _renumberSegments() {
        if (!this.segmentsContainer) return;
        
        const segments = this.segmentsContainer.querySelectorAll('.training-segment');
        const totalSegments = segments.length;
        
        segments.forEach((segment, index) => {
            // 更新段落标题
            const header = segment.querySelector('h4');
            if (header) {
                header.textContent = `段落 ${index + 1}`;
            }
            
            // 更新删除按钮显示状态
            const removeBtn = segment.querySelector('.remove-segment-btn');
            if (removeBtn) {
                removeBtn.style.display = totalSegments >= 3 ? 'block' : 'none';
            }
        });
    }
    
    /**
     * 获取所有段落配置
     * @returns {Array<Object>}
     */
    getSegmentsConfig() {
        if (!this.segmentsContainer) return [];
        
        const segments = [];
        const segmentElements = this.segmentsContainer.querySelectorAll('.training-segment');
        
        segmentElements.forEach(segment => {
            const bpm = parseInt(segment.querySelector('.segment-bpm').value, 10);
            const beats = parseInt(segment.querySelector('.segment-beats').value, 10);
            const repeats = parseInt(segment.querySelector('.segment-repeats').value, 10);
            
            // 验证值
            if (!isNaN(bpm) && !isNaN(beats) && !isNaN(repeats)) {
                segments.push({
                    bpm,
                    beats,
                    repeats
                });
            }
        });
        
        return segments;
    }
    
    /**
     * 处理开始训练
     * @private
     */
    _handleStartTraining() {
        try {
            // 获取段落配置
            const segments = this.getSegmentsConfig();
            
            if (segments.length === 0) {
                alert('请添加至少一个训练段落');
                return;
            }
            
            // 更新状态以开始训练
            updateState({
                isTraining: true,
                trainingSegments: segments,
                trainingState: {
                    currentSegmentIndex: 0,
                    currentRepeat: 1,
                    remainingBeats: segments[0].beats
                }
            });
            
            // 触发开始训练事件
            window.dispatchEvent(new CustomEvent('training:start', {
                detail: { segments }
            }));
            
            console.log('开始训练');
        } catch (error) {
            console.error('开始训练失败:', error);
            alert('开始训练失败: ' + error.message);
        }
    }
    
    /**
     * 处理停止训练
     * @private
     */
    _handleStopTraining() {
        try {
            // 更新状态以停止训练
            updateState({
                isTraining: false
            });
            
            // 触发停止训练事件
            window.dispatchEvent(new CustomEvent('training:stop'));
            
            console.log('停止训练');
        } catch (error) {
            console.error('停止训练失败:', error);
            alert('停止训练失败: ' + error.message);
        }
    }
    
    /**
     * 处理重置训练
     * @private
     */
    _handleResetTraining() {
        try {
            // 更新状态以重置训练
            updateState({
                isTraining: false,
                trainingState: null
            });
            
            // 触发重置训练事件
            window.dispatchEvent(new CustomEvent('training:reset'));
            
            // 重置UI显示
            this._resetTrainingDisplay();
            
            console.log('重置训练');
        } catch (error) {
            console.error('重置训练失败:', error);
            alert('重置训练失败: ' + error.message);
        }
    }
    
    /**
     * 处理段落变更
     * @private
     * @param {CustomEvent} event - 段落变更事件
     */
    _handleSegmentChange(event) {
        const { segmentIndex, segment } = event.detail;
        console.log(`切换到段落 ${segmentIndex + 1}:`, segment);
        
        // 更新当前段落显示
        if (this.currentSegment) {
            setText(this.currentSegment, `段落 ${segmentIndex + 1} / ${this.getSegmentsConfig().length}`);
        }
    }
    
    /**
     * 处理训练更新
     * @private
     * @param {CustomEvent} event - 训练更新事件
     */
    _handleTrainingUpdate(event) {
        const { state } = event.detail;
        this._updateTrainingStatusDisplay(state);
    }
    
    /**
     * 处理训练完成
     * @private
     */
    _handleTrainingComplete() {
        console.log('训练完成');
        
        // 重置训练状态
        updateState({
            isTraining: false
        });
        
        // 重置UI显示
        this._resetTrainingDisplay();
        
        alert('训练完成！');
    }
    
    /**
     * 更新训练控制按钮状态
     * @private
     * @param {boolean} isTraining - 是否正在训练
     */
    _updateTrainingControls(isTraining) {
        if (this.startTrainingBtn) {
            toggleClass(this.startTrainingBtn, 'hidden', isTraining);
        }
        
        if (this.stopTrainingBtn) {
            toggleClass(this.stopTrainingBtn, 'hidden', !isTraining);
        }
        
        if (this.resetTrainingBtn) {
            toggleClass(this.resetTrainingBtn, 'hidden', !isTraining);
        }
    }
    
    /**
     * 更新训练状态显示
     * @private
     * @param {Object} state - 训练状态
     */
    _updateTrainingStatusDisplay(state) {
        if (!state) return;
        
        if (this.trainingStatus) {
            setText(this.trainingStatus, state.isTraining ? '训练进行中' : '训练已停止');
        }
        
        if (this.remainingTime) {
            const segments = this.getSegmentsConfig();
            const currentSegment = segments[state.currentSegmentIndex];
            
            if (currentSegment) {
                setText(this.remainingTime, `剩余节拍: ${state.remainingBeats}`);
            }
        }
    }
    
    /**
     * 重置训练显示
     * @private
     */
    _resetTrainingDisplay() {
        if (this.trainingStatus) {
            setText(this.trainingStatus, '准备就绪');
        }
        
        if (this.currentSegment) {
            setText(this.currentSegment, '未开始');
        }
        
        if (this.remainingTime) {
            setText(this.remainingTime, '0');
        }
    }
    
    /**
     * 销毁训练模式UI控制器，清理资源
     * 
     * @example
     * // 销毁训练模式UI控制器
     * trainingUIController.destroy();
     */
    destroy() {
        if (!this.initialized) return;
        
        // 取消状态订阅
        if (this.unsubscribeState) {
            this.unsubscribeState();
        }
        
        // 这里可以添加其他清理逻辑
        this.initialized = false;
        console.log('训练模式UI控制器已销毁');
    }
}

/**
 * 训练模式UI控制器实例
 * @type {TrainingUIController}
 */
export const trainingUIController = new TrainingUIController();