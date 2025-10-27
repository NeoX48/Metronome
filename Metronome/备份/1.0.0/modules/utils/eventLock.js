/**
 * 事件锁管理器 - 防止事件重复触发
 */
class EventLockManager {
    constructor() {
        this.locks = new Map();
    }
    
    /**
     * 尝试获取锁
     * @param {string} key - 锁的键名
     * @param {number} duration - 锁的持续时间（毫秒）
     * @returns {boolean} 是否成功获取锁
     */
    tryLock(key, duration = 300) {
        if (this.locks.has(key)) {
            console.warn(`⚠️ [EventLock] 锁 "${key}" 已存在，阻止重复操作`);
            return false;
        }
        
        this.locks.set(key, true);
        console.log(`🔒 [EventLock] 获取锁 "${key}"，持续 ${duration}ms`);
        
        setTimeout(() => {
            this.locks.delete(key);
            console.log(`🔓 [EventLock] 释放锁 "${key}"`);
        }, duration);
        
        return true;
    }
    
    /**
     * 检查是否已锁定
     */
    isLocked(key) {
        return this.locks.has(key);
    }
    
    /**
     * 手动释放锁
     */
    unlock(key) {
        this.locks.delete(key);
        console.log(`🔓 [EventLock] 手动释放锁 "${key}"`);
    }
}

export const eventLockManager = new EventLockManager();
