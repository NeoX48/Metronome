/**
 * 配置模块单元测试
 */

// 在实际环境中，这里会导入测试框架和被测模块
// 由于我们使用简单的测试框架，直接在浏览器中运行测试

// 模拟导入被测模块
let CONFIG, updateConfig, getConfig;

// 测试结果存储
const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
};

// 辅助函数：测试断言
function assert(condition, message) {
    testResults.total++;
    if (!condition) {
        testResults.failed++;
        testResults.failures.push(`断言失败: ${message}`);
        console.error(`断言失败: ${message}`);
    } else {
        testResults.passed++;
        console.log(`测试通过: ${message}`);
    }
}

// 辅助函数：运行测试套件
function runTestSuite(suiteName, testFunction) {
    console.log(`\n=== 运行测试套件: ${suiteName} ===`);
    try {
        testFunction();
    } catch (error) {
        console.error(`测试套件执行出错: ${error.message}`);
        console.error(error.stack);
    }
}

// 辅助函数：显示测试结果
function showTestResults() {
    console.log('\n=== 测试结果汇总 ===');
    console.log(`总测试数: ${testResults.total}`);
    console.log(`通过测试数: ${testResults.passed}`);
    console.log(`失败测试数: ${testResults.failed}`);
    
    if (testResults.failures.length > 0) {
        console.log('\n失败详情:');
        testResults.failures.forEach((failure, index) => {
            console.log(`${index + 1}. ${failure}`);
        });
    }
    
    return testResults.passed === testResults.total;
}

// 测试函数
async function runConfigTests() {
    // 动态导入被测模块
    try {
        const module = await import('../../modules/utils/config.js');
        CONFIG = module.CONFIG;
        updateConfig = module.updateConfig;
        getConfig = module.getConfig;
        console.log('模块导入成功');
    } catch (error) {
        console.error('模块导入失败:', error);
        return false;
    }
    
    // 运行测试套件
    runTestSuite('config.js - 默认配置验证', testDefaultConfig);
    runTestSuite('config.js - getConfig函数测试', testGetConfig);
    runTestSuite('config.js - updateConfig函数测试', testUpdateConfig);
    
    // 返回测试结果
    return showTestResults();
}

// 测试默认配置
function testDefaultConfig() {
    assert(typeof CONFIG === 'object', 'CONFIG应该是一个对象');
    assert(CONFIG.defaultBPM === 120, '默认BPM应该是120');
    assert(CONFIG.minBPM === 40, '最小BPM应该是40');
    assert(CONFIG.maxBPM === 208, '最大BPM应该是208');
    assert(CONFIG.defaultVolume === 70, '默认音量应该是70');
    assert(Array.isArray(CONFIG.soundTypes), 'soundTypes应该是一个数组');
    assert(CONFIG.soundTypes.includes('accent'), 'soundTypes应该包含accent');
    assert(CONFIG.soundTypes.includes('normal'), 'soundTypes应该包含normal');
    assert(typeof CONFIG.keyboardShortcuts === 'object', 'keyboardShortcuts应该是一个对象');
}

// 测试getConfig函数
function testGetConfig() {
    // 测试获取单个配置项
    assert(getConfig('defaultBPM') === 120, 'getConfig应该正确返回defaultBPM');
    assert(getConfig('minBPM') === 40, 'getConfig应该正确返回minBPM');
    assert(getConfig('maxBPM') === 208, 'getConfig应该正确返回maxBPM');
    
    // 测试获取嵌套配置项
    assert(getConfig('defaultTimeSignature.numerator') === 4, 'getConfig应该正确返回嵌套配置');
    assert(getConfig('defaultTimeSignature.denominator') === 4, 'getConfig应该正确返回嵌套配置');
    assert(getConfig('keyboardShortcuts.toggle') === ' ', 'getConfig应该正确返回快捷键配置');
    
    // 测试获取不存在的配置项
    assert(getConfig('nonExistentConfig') === undefined, '获取不存在的配置项应该返回undefined');
}

// 测试updateConfig函数
function testUpdateConfig() {
    // 保存原始配置以便恢复
    const originalDefaultBPM = CONFIG.defaultBPM;
    
    try {
        // 测试更新有效配置
        assert(updateConfig('defaultBPM', 130) === 130, 'updateConfig应该正确更新defaultBPM并返回新值');
        assert(CONFIG.defaultBPM === 130, 'CONFIG对象中的defaultBPM应该已更新');
        
        // 测试更新嵌套配置
        assert(updateConfig('defaultTimeSignature.numerator', 3) === 3, 'updateConfig应该正确更新嵌套配置');
        assert(CONFIG.defaultTimeSignature.numerator === 3, '嵌套配置应该已更新');
        
        // 测试更新音量配置
        assert(updateConfig('defaultVolume', 80) === 80, 'updateConfig应该正确更新defaultVolume');
        
        // 测试更新无效配置项 - 应该抛出错误
        let errorThrown = false;
        try {
            updateConfig('nonExistentConfig', 'value');
        } catch (error) {
            errorThrown = true;
        }
        assert(errorThrown, 'updateConfig更新不存在的配置项应该抛出错误');
        
        // 测试更新无效BPM - 应该抛出错误
        errorThrown = false;
        try {
            updateConfig('defaultBPM', 250); // 超过最大限制
        } catch (error) {
            errorThrown = true;
        }
        assert(errorThrown, 'updateConfig使用无效的BPM值应该抛出错误');
        
    } finally {
        // 恢复原始配置
        CONFIG.defaultBPM = originalDefaultBPM;
        CONFIG.defaultTimeSignature.numerator = 4;
        CONFIG.defaultVolume = 70;
    }
}

// 导出测试函数
export { runConfigTests };