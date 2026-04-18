document.addEventListener('DOMContentLoaded', () => {
    let isDrawing = false;
    const canvas = document.getElementById('screenshotCanvas');
    const ctx = canvas.getContext('2d');
    const collectBtn = document.getElementById('collectBtn');

    collectBtn.onclick = async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // 1. Скриншот
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            initCanvas(dataUrl);
            
            // 2. Сбор данных через Content Script
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: runDeepScan,
            }, (results) => {
                if (results && results[0].result) {
                    generateFinalReport(results[0].result);
                }
            });
        });
    };

    function runDeepScan() {
        // Сетевой аудит
        const netErrors = window.performance.getEntriesByType("resource")
            .filter(r => r.responseStatus >= 400)
            .map(r => `${r.name.split('/').pop()} (HTTP ${r.responseStatus})`);

        // Дизайн аудит
        const design = {
            noAlt: Array.from(document.querySelectorAll('img')).filter(img => !img.alt).length,
            inlineStyles: document.querySelectorAll('[style]').length,
            noH1: document.querySelector('h1') === null,
            emptyBtns: Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === "").length
        };

        return {
            url: window.location.href,
            ua: navigator.userAgent,
            screen: `${window.screen.width}x${window.screen.height}`,
            timestamp: new Date().toLocaleString(),
            netErrors,
            design
        };
    }

    function initCanvas(dataUrl) {
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            ctx.strokeStyle = "#ff0000"; 
            ctx.lineWidth = 15;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
        };
        img.src = dataUrl;
    }

    // Рисование
    canvas.onmousedown = (e) => { isDrawing = true; draw(e); };
    canvas.onmouseup = () => { isDrawing = false; ctx.beginPath(); };
    canvas.onmousemove = (e) => { if (isDrawing) draw(e); };

    function draw(e) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    function generateFinalReport(data) {
        // Маскировка данных
        const mask = (text) => text.replace(/(password|token|key|secret|bearer)=[^&\s]+/gi, "$1=[REDACTED]");
        
        const report = `### 🕵️‍♂️ BUG_REPORT_SECURE
**TIMESTAMP:** ${data.timestamp}
**URL:** ${mask(data.url)}
**ENVIRONMENT:** ${data.ua} [${data.screen}]

**NETWORK_ALERTS:**
${data.netErrors.length > 0 ? data.netErrors.map(e => `- ⚠️ ${e}`).join('\n') : '- No critical network errors'}

**DESIGN_AUDIT:**
- 🖼️ Missing Alt: ${data.design.noAlt}
- 🎨 Inline Styles: ${data.design.inlineStyles}
- 📝 Missing H1: ${data.design.noH1 ? 'YES' : 'NO'}
- 🔘 Empty Buttons: ${data.design.emptyBtns}

**ACTUAL_RESULT:**
[DESCRIBE_ISSUE_HERE]`;

        document.getElementById('output').value = report;
        document.getElementById('reportSection').classList.remove('hidden');
        collectBtn.innerText = "RESYNC_SYSTEM";
    }

    // Инструменты
    document.getElementById('colorRed').onclick = () => ctx.strokeStyle = "#ff0000";
    document.getElementById('colorCyan').onclick = () => ctx.strokeStyle = "#22d3ee";
    document.getElementById('copyBtn').onclick = () => {
        document.getElementById('output').select();
        document.execCommand('copy');
        alert('REPORT_COPIED');
    };
    document.getElementById('downloadImg').onclick = () => {
        const link = document.createElement('a');
        link.download = `bug_evidence_${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    };
});