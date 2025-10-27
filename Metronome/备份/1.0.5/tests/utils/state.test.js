/**
 * 状态管理模块单元测试
 */

// 在实际环境中，这里会导入测试框架和被测模块
// 由于我们使用简单的测试框架，直接在浏览器中运行测试

// 模拟导入被测模块
let getState, updateState, subscribeToState, resetState;

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
async function runStateTests() {
    // 动态导入被测模块
    try {
        const module = await import('../../modules/utils/state.js');
        getState = module.getState;
        updateState = module.updateState;
        subscribeToState = module.subscribeToState;
        resetState = module.resetState;
        console.log('模块导入成功');
    } catch (error) {
        console.error('模块导入失败:', error);
        return false;
    }
    
    // 保存初始状态
    const initialState = { ...getState() };
    
    try {
        // 运行测试套件
        runTestSuite('state.js - 初始状态验证', testInitialState);
        runTestSuite('state.js - getState函数测试', testGetState);
        runTestSuite('state.js - updateState函数测试', testUpdateState);
        runTestSuite('state.js - subscribeToState函数测试', testSubscribeToState);
        runTestSuite('state.js - resetState函数测试', testResetState);
    } finally {
        // 恢复初始状态
        // 注意：这里假设resetState可以恢复到默认状态
        resetState();
    }
    
    // 返回测试结果
    return showTestResults();
}

// 测试初始状态
function testInitialState() {
    const state = getState();
    assert(typeof state === 'object', '初始状态应该是一个对象');
    assert(typeof state.bpm === 'number', '状态应该包含bpm属性');
    assert(typeof state.volume === 'number', '状态应该包含volume属性');
    assert(typeof state.isRunning === 'boolean', '状态应该包含isRunning属性');
    assert(typeof state.beatNumerator === 'number', '状态应该包含beatNumerator属性');
    assert(typeof state.beatDenominator === 'number', '状态应该包含beatDenominator属性');
    assert(typeof state.isTraining === 'boolean', '状态应该包含isTraining属性');
}

// 测试getState函数
function testGetState() {
    // 测试获取完整状态
    const state = getState();
    assert(typeof state === 'object', 'getState应该返回状态对象');
    assert(Object.keys(state).length > 0, '状态对象应该包含属性');
    
    // 测试状态对象的完整性
    assert('bpm' in state, '状态应该包含bpm属性');
    assert('volume' in state, '状态应该包含volume属性');
    assert('isRunning' in state, '状态应该包含isRunning属性');
    assert('beatNumerator' in state, '状态应该包含beatNumerator属性');
    assert('beatDenominator' in state, '状态应该包含beatDenominator属性');
    assert('isTraining' in state, '状态应该包含isTraining属性');
}

// 测试updateState函数
function testUpdateState() {
    // 测试更新单个属性
    const newBPM = 130;
    const updatedState = updateState({ bpm: newBPM });
    assert(updatedState.bpm === newBPM, 'updateState应该正确更新bpm属性');
    
    // 测试当前状态也被更新
    assert(getState().bpm === newBPM, 'getState应该返回更新后的状态');
    
    // 测试更新多个属性
    const newVolume = 85;
    const newIsRunning = true;
    const multiUpdateState = updateState({
        volume: newVolume,
        isRunning: newIsRunning
    });
    assert(multiUpdateState.volume === newVolume, '应该正确更新volume属性');
    assert(multiUpdateState.isRunning === newIsRunning, '应该正确更新isRunning属性');
    assert(multiUpdateState.bpm === newBPM, '未更新的属性应该保持不变');
    
    // 测试更新嵌套属性
    const trainingState = { currentSegmentIndex: 1, remainingBeats: 8 };
    const nestedUpdateState = updateState({ trainingState });
    assert(nestedUpdateState.trainingState === trainingState, '应该正确更新嵌套对象');
    assert(nestedUpdateState.trainingState.currentSegmentIndex === 1, '嵌套属性应该正确设置');
}

// 测试subscribeToState函数
function testSubscribeToState() {
    // 准备测试数据
    let stateChanged = false;
    let prevState = null;
    let newState = null;
    
    // 创建订阅者
    const unsubscribe = subscribeToState((prev, next) => {
        stateChanged = true;
        prevState = prev;
        newState = next;
    });
    
    // 验证订阅函数是否是一个函数
    assert(typeof unsubscribe === 'function', 'subscribeToState应该返回一个取消订阅函数');
    
    // 更新状态并验证订阅者被调用
    const initialBPM = getState().bpm;
    const updatedBPM = initialBPM + 10;
    updateState({ bpm: updatedBPM });
    
    assert(stateChanged, '状态更新时应该调用订阅者函数');
    assert(prevState !== null, '应该提供前一个状态');
    assert(newState !== null, '应该提供新的状态');
    assert(prevState.bpm === initialBPM, '前一个状态的bpm应该是更新前的值');
    assert(newState.bpm === updatedBPM, '新状态的bpm应该是更新后的值');
    
    // 测试取消订阅
    stateChanged = false;
    unsubscribe();
    updateState({ bpm: updatedBPM + 5 });
    assert(!stateChanged, '取消订阅后不应该再调用订阅者函数');
    
    // 测试多个订阅者
    let subscriber1Called = false;
    let subscriber2Called = false;
    
    const unsubscribe1 = subscribeToState(() => {
        subscriber1Called = true;
    });
    
    const unsubscribe2 = subscribeToState(() => {
        subscriber2Called = true;
    });
    
    updateState({ volume: 50 });
    assert(subscriber1Called, '多个订阅者时第一个应该被调用');
    assert(subscriber2Called, '多个订阅者时第二个应该被调用');
    
    // 清理
    unsubscribe1();
    unsubscribe2();
}

// 测试resetState函数
function testResetState() {
    // 先更新一些状态
    updateState({
        bpm: 150,
        volume: 90,
        isRunning: true,
        trainingState: { someProperty: 'value' }
    });
    
    // 重置状态
    const resetState = resetState();
    
    // 验证状态被重置
    assert(resetState.bpm === 120, 'resetState应该将bpm重置为默认值');
    assert(resetState.volume === 70, 'resetState应该将volume重置为默认值');
    assert(resetState.isRunning === false, 'resetState应该将isRunning重置为默认值');
    assert(resetState.trainingState === null, 'resetState应该将trainingState重置为null');
    
    // 验证当前状态也被重置
    const currentState = getState();
    assert(currentState.bpm === 120, 'getState应该返回重置后的状态');
    assert(currentState.volume === 70, 'getState应该返回重置后的状态');
    assert(currentState.isRunning === false, 'getState应该返回重置后的状态');
    assert(currentState.trainingState === null, 'getState应该返回重置后的状态');
}

// 导出测试函数
export { runStateTests };