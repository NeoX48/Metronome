class EventLockManager {
    constructor() {
        this.locks = new Map();
    }
    
    /**
     * 尝试获取事件锁
     * @param {string} key - 锁的唯一标识
     * @param {number} duration - 锁的持续时间（毫秒）
     * @returns {boolean} 是否成功获取锁
     */
    tryLock(key, duration) {
        // 检查是否已存在锁
        if (this.locks.has(key)) {
            console.warn(`⚠️ [EventLock] 锁 "${key}" 已存在，阻止重复操作`);
            return false;
        }
        
        // 创建新锁
        this.locks.set(key, true);
        console.log(`🔒 [EventLock] 获取锁 "${key}"，持续 ${duration}ms`);
        
        // 设置定时器，到期后自动释放锁
        setTimeout(() => {
            this.unlock(key);
        }, duration);
        
        return true;
    }
    
    /**
     * 手动释放锁
     * @param {string} key - 锁的唯一标识
     */
    unlock(key) {
        if (this.locks.has(key)) {
            this.locks.delete(key);
            console.log(`🔓 [EventLock] 释放锁 "${key}"`);
        }
    }
    
    /**
     * 检查锁是否存在
     * @param {string} key - 锁的唯一标识
     * @returns {boolean} 锁是否存在
     */
    hasLock(key) {
        return this.locks.has(key);
    }
    
    /**
     * 清除所有锁
     */
    clearAll() {
        this.locks.clear();
        console.log(`🔓 [EventLock] 清除所有锁`);
    }
}

export const eventLockManager = new EventLockManager();