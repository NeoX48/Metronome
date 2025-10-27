// 错误检查脚本
console.log('开始检查JavaScript错误...');

// 尝试直接运行并捕获错误
try {
  // 读取index.html内容
  fetch('index.html')
    .then(response => response.text())
    .then(html => {
      // 提取所有script标签内容
      const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
      let match;
      let scriptIndex = 0;
      
      console.log('开始分析script标签...');
      
      while ((match = scriptRegex.exec(html)) !== null) {
        const scriptContent = match[1];
        // 跳过空脚本或包含src属性的脚本
        if (scriptContent.trim() && !match[0].includes('src=')) {
          scriptIndex++;
          console.log(`\n检查脚本 ${scriptIndex} (大约位置: ${match.index})`);
          
          // 尝试创建并评估脚本
          try {
            // 创建一个安全的环境来检查语法错误
            const scriptFunction = new Function(scriptContent);
            console.log(`脚本 ${scriptIndex}: 语法检查通过`);
          } catch (e) {
            console.error(`脚本 ${scriptIndex}: 发现语法错误!`);
            console.error('错误信息:', e.message);
            
            // 尝试定位错误行
            const lines = scriptContent.split('\n');
            // 显示可能包含错误的代码段
            console.log('前10行内容:');
            for (let i = 0; i < Math.min(10, lines.length); i++) {
              console.log(`${i + 1}: ${lines[i]}`);
            }
          }
        }
      }
      
      console.log('\n脚本检查完成');
    })
    .catch(error => {
      console.error('读取文件失败:', error);
    });
} catch (error) {
  console.error('检查过程中发生错误:', error);
}