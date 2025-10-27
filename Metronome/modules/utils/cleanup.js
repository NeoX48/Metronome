// 清理模块 - 提供统一的安全清理功能
import { getUIController } from '../ui/controls.js';

// 获取控制器实例（按需加载）
const uiController = getUIController();

// 添加模块存在性断言 
console.assert(uiController, '[致命错误] uiController模块未加载');

// 添加模块加载验证
if (!uiController) {
  throw new Error('[致命错误] uiController 模块未正确加载');
}

/**
 * 统一的安全清理函数 - 处理UI控制器的资源释放
 * 使用destroy方法，与init.js中的调用保持一致
 */
export function safeCleanup() { 
  try {
    // 优先使用destroy方法，与init.js保持一致
    if (typeof uiController?.destroy === 'function') {
      uiController.destroy();
      return true;
    } 
    
    // 降级处理：如果destroy不存在，尝试其他可能的清理方法
    if (typeof uiController?.cleanup === 'function') {
      console.warn('使用备用cleanup方法');
      uiController.cleanup();
      return true;
    }
    
    console.error('uiController缺少有效的清理方法');
    return false;
  } catch (error) {
    console.error('执行安全清理时出错:', error);
    return false;
  }
}