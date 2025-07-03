// Configuration
let API_KEY = localStorage.getItem('apiKey') || '';
const API_URL = 'http://localhost:3000/api/analyze';

// DOM Elements
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const cameraBtn = document.getElementById('camera-btn');
const previewArea = document.getElementById('preview-area');
const previewImage = document.getElementById('preview-image');
const analyzeBtn = document.getElementById('analyze-btn');
const resultArea = document.getElementById('result-area');
const analysisResult = document.getElementById('analysis-result');
const historyList = document.getElementById('history-list');
const dateFilter = document.getElementById('date-filter');
const foodTypeChart = document.getElementById('food-type-chart');
const nutritionChart = document.getElementById('nutrition-chart');
const caloriesTrendChart = document.getElementById('calories-trend-chart');
const aiSuggestions = document.getElementById('ai-suggestions');
const apiKeyInput = document.getElementById('apiKey');
const toggleApiKeyBtn = document.getElementById('toggleApiKey');
const saveApiKeyBtn = document.getElementById('saveApiKey');
const apiKeyReminder = document.getElementById('apiKeyReminder');
const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));

// Pagination variables
let currentPage = 1;
const pageSize = document.getElementById('page-size');
const totalItems = document.getElementById('total-items');
const pagination = document.getElementById('pagination');

// Chart instances
let nutritionChartInstance = null;
let foodTypeChartInstance = null;
let caloriesTrendChartInstance = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    checkApiKey();
    setupEventListeners();
});

function setupEventListeners() {
    // API Key toggle
    if (toggleApiKeyBtn) {
        toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);
    }

    // Save API Key
    if (saveApiKeyBtn) {
        saveApiKeyBtn.addEventListener('click', saveApiKey);
    }

    // Page navigation
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', handlePageNavigation);
    });

    // File upload
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    cameraBtn.addEventListener('click', handleCameraCapture);
    analyzeBtn.addEventListener('click', analyzeImageHandler);

    // History filtering
    document.querySelectorAll('.btn-group .btn').forEach(btn => {
        btn.addEventListener('click', handleHistoryFilter);
    });

    // Pagination
    pageSize.addEventListener('change', () => {
        currentPage = 1;
        loadHistory();
    });

    // Date filter
    dateFilter.addEventListener('change', loadHistory);
}

// API Key functions
function checkApiKey() {
    API_KEY = localStorage.getItem('apiKey') || '';
    if (!API_KEY) {
        apiKeyReminder.style.display = 'block';
        analyzeBtn.disabled = true;
    } else {
        apiKeyReminder.style.display = 'none';
        analyzeBtn.disabled = false;
        if (apiKeyInput) {
            apiKeyInput.value = API_KEY;
        }
    }
}

function toggleApiKeyVisibility() {
    const type = apiKeyInput.type;
    apiKeyInput.type = type === 'password' ? 'text' : 'password';
    toggleApiKeyBtn.innerHTML = `<i class="fas fa-eye${type === 'password' ? '' : '-slash'}"></i>`;
}

function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        alert('Please enter an API Key');
        return;
    }

    localStorage.setItem('apiKey', apiKey);
    API_KEY = apiKey;
    checkApiKey();
    settingsModal.hide();
    alert('API Key saved successfully');
}

// Page navigation
function handlePageNavigation(e) {
    e.preventDefault();
    const targetPage = e.currentTarget.getAttribute('data-page');
    if (!targetPage) return;

    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('d-none');
    });
    const targetElement = document.getElementById(`${targetPage}-page`);
    if (targetElement) {
        targetElement.classList.remove('d-none');
    }

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(navLink => {
        navLink.classList.remove('active');
    });
    e.currentTarget.classList.add('active');

    // Load appropriate data
    if (targetPage === 'history') {
        loadHistory();
    } else if (targetPage === 'overview') {
        loadOverview();
    }
}

// Image handling
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleCameraCapture() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                const video = document.createElement('video');
                video.srcObject = stream;
                video.play();
                
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                video.onloadeddata = () => {
                    canvas.getContext('2d').drawImage(video, 0, 0);
                    stream.getTracks().forEach(track => track.stop());
                    
                    canvas.toBlob(blob => {
                        const file = new File([blob], 'camera.jpg', { type: 'image/jpeg' });
                        handleFile(file);
                    }, 'image/jpeg');
                };
            })
            .catch(err => {
                alert('Camera access error: ' + err.message);
            });
    } else {
        alert('Your browser does not support camera access');
    }
}

function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewArea.classList.remove('d-none');
        resultArea.classList.add('d-none');
    };
    reader.readAsDataURL(file);
}

// Image analysis
async function analyzeImageHandler() {
    const loading = document.createElement('div');
    loading.className = 'loading';
    analyzeBtn.appendChild(loading);
    analyzeBtn.disabled = true;
    analysisResult.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Analyzing...</div>';

    try {
        const base64Image = previewImage.src.split(',')[1];
        if (!base64Image) {
            throw new Error('Failed to get image data');
        }

        console.log('Sending image data, length:', base64Image.length);
        const response = await analyzeImage(base64Image);
        
        saveToHistory(response);
        displayAnalysisResult(response);
        resultArea.classList.remove('d-none');
    } catch (error) {
        console.error('Analysis error:', error);
        analysisResult.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle"></i> Analysis failed: ${error.message}
                <p class="mt-2 small">${error.stack || ''}</p>
            </div>
        `;
    } finally {
        const loadingElement = analyzeBtn.querySelector('.loading');
        if (loadingElement) {
            analyzeBtn.removeChild(loadingElement);
        }
        analyzeBtn.disabled = false;
    }
}

async function analyzeImage(base64Image) {
    const apiKey = localStorage.getItem('apiKey');
    
    if (!apiKey) {
        throw new Error('请先设置API Key');
    }

    try {
        // 第一步：使用qwen-vl-max-latest分析图片
        const imageAnalysisResponse = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                apiKey: apiKey,
                data: {
                    model: 'qwen-vl-max-latest',
                    input: {
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    {
                                        image: base64Image
                                    },
                                    {
                                        text: '请分析这张食物图片，提供以下信息：1. 食物名称 2. 主要营养成分 3. 卡路里含量（估算）4. 健康建议'
                                    }
                                ]
                            }
                        ]
                    }
                }
            })
        });

        if (!imageAnalysisResponse.ok) {
            const errorText = await imageAnalysisResponse.text();
            console.error('图片分析API响应:', errorText);
            throw new Error(`图片分析API请求失败: ${imageAnalysisResponse.status}`);
        }

        let imageData;
        try {
            imageData = await imageAnalysisResponse.json();
        } catch (error) {
            console.error('解析图片分析响应错误:', error);
            throw new Error('无法解析服务器响应');
        }

        // 直接返回原始API响应，不再进行结构化处理
        return {
            rawResponse: imageData,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('API调用错误:', error);
        throw error;
    }
}

// Local storage
function saveToHistory(analysis) {
    const history = JSON.parse(localStorage.getItem('foodHistory') || '[]');
    history.push({
        date: new Date().toISOString(),
        analysis: analysis
    });
    localStorage.setItem('foodHistory', JSON.stringify(history));
}

// Configure marked
marked.setOptions({
    highlight: function(code, lang) {
        return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true
});

// Display analysis result
function displayAnalysisResult(result) {
    if (!result) {
        analysisResult.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle"></i> 未收到分析结果
            </div>
        `;
        return;
    }

    // 创建显示原始JSON的按钮
    const toggleButton = document.createElement('button');
    toggleButton.className = 'btn btn-sm btn-outline-secondary mb-3';
    toggleButton.innerHTML = '<i class="fas fa-code"></i> 显示原始数据';
    toggleButton.addEventListener('click', () => {
        const rawDataElement = document.getElementById('raw-response-data');
        if (rawDataElement.style.display === 'none') {
            rawDataElement.style.display = 'block';
            toggleButton.innerHTML = '<i class="fas fa-code"></i> 隐藏原始数据';
        } else {
            rawDataElement.style.display = 'none';
            toggleButton.innerHTML = '<i class="fas fa-code"></i> 显示原始数据';
        }
    });

    // 创建格式化后的结果显示区域
    let formattedResult = '';
    if (result.rawResponse?.output?.text) {
        // 尝试解析AI返回的文本
        formattedResult = marked.parse(result.rawResponse.output.text);
    } else {
        formattedResult = `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle"></i> 无法解析分析结果，请查看原始数据
            </div>
        `;
    }

    // 创建原始数据展示区域
    const rawDataElement = document.createElement('pre');
    rawDataElement.id = 'raw-response-data';
    rawDataElement.className = 'bg-light p-3 rounded';
    rawDataElement.style.display = 'none';
    rawDataElement.textContent = JSON.stringify(result, null, 2);

    // 组合所有元素
    analysisResult.innerHTML = '';
    analysisResult.appendChild(toggleButton);
    analysisResult.innerHTML += formattedResult;
    analysisResult.appendChild(rawDataElement);
}

// History functions
function loadHistory() {
    if (!historyList) return;

    const history = JSON.parse(localStorage.getItem('foodHistory') || '[]');
    if (history.length === 0) {
        historyList.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle"></i> No history records found
            </div>
        `;
        totalItems.textContent = '0';
        pagination.innerHTML = '';
        return;
    }

    const activePeriod = document.querySelector('.btn-group .active')?.dataset.period || 'day';
    const filterDate = dateFilter ? dateFilter.value : '';
    
    let filteredHistory = filterHistoryByPeriod(history, activePeriod, filterDate);
    const groupedHistory = groupHistoryByDate(filteredHistory);
    displayGroupedHistory(groupedHistory);
}

function filterHistoryByPeriod(history, period, filterDate) {
    if (filterDate) {
        return history.filter(item => item.date.startsWith(filterDate));
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
        case 'day':
            return history.filter(item => {
                const itemDate = new Date(item.date);
                return itemDate >= today;
            });
        case 'week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            return history.filter(item => {
                const itemDate = new Date(item.date);
                return itemDate >= weekStart;
            });
        case 'month':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            return history.filter(item => {
                const itemDate = new Date(item.date);
                return itemDate >= monthStart;
            });
        case 'all':
        default:
            return history;
    }
}

function groupHistoryByDate(history) {
    const groups = {};
    history.forEach(item => {
        const date = new Date(item.date);
        const dateStr = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
        
        if (!groups[dateStr]) {
            groups[dateStr] = [];
        }
        groups[dateStr].push(item);
    });
    
    return groups;
}

function displayGroupedHistory(groups) {
    if (Object.keys(groups).length === 0) {
        historyList.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle"></i> No records found for selected period
            </div>
        `;
        totalItems.textContent = '0';
        pagination.innerHTML = '';
        return;
    }

    const sortedGroups = Object.entries(groups)
        .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA));

    const pageCount = Math.ceil(sortedGroups.length / parseInt(pageSize.value));
    const start = (currentPage - 1) * parseInt(pageSize.value);
    const end = start + parseInt(pageSize.value);
    const currentGroups = sortedGroups.slice(start, end);

    historyList.innerHTML = currentGroups
        .map(([date, items]) => `
            <div class="card mb-4">
                <div class="card-header bg-light">
                    <h6 class="mb-0">
                        <i class="fas fa-calendar-day"></i> ${date}
                    </h6>
                </div>
                <div class="card-body">
                    ${items.map(item => formatHistoryItem(item)).join('')}
                </div>
            </div>
        `).join('');

    totalItems.textContent = sortedGroups.length;
    generatePagination(pageCount);

    document.querySelectorAll('.delete-history').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const date = e.currentTarget.dataset.date;
            if (date) {
                deleteHistoryItem(date);
            }
        });
    });
}

function formatHistoryItem(item) {
    if (!item || !item.analysis || !item.analysis.food) {
        return '';
    }

    const food = item.analysis.food;
    const time = new Date(item.date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    return `
        <div class="card mb-2 history-item">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                    <h6 class="card-title mb-1">
                        <i class="fas fa-utensils"></i> ${food.name || 'Unknown food'}
                    </h6>
                    <div>
                        <small class="text-muted me-2">
                            <i class="fas fa-clock"></i> ${time}
                        </small>
                        <button class="btn btn-sm btn-outline-danger delete-history" data-date="${item.date}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="card-text">
                    <p class="mb-1"><strong>Nutrients:</strong> ${food.nutrition || 'Not identified'}</p>
                    <p class="mb-1"><strong>Calories:</strong> ${food.calories || 'Not identified'}</p>
                    <p class="mb-0"><strong>Advice:</strong> ${food.advice || 'No advice provided'}</p>
                </div>
            </div>
        </div>
    `;
}

function handleHistoryFilter(e) {
    document.querySelectorAll('.btn-group .btn').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    loadHistory();
}

function deleteHistoryItem(date) {
    const history = JSON.parse(localStorage.getItem('foodHistory') || '[]');
    const newHistory = history.filter(item => item.date !== date);
    localStorage.setItem('foodHistory', JSON.stringify(newHistory));
    loadHistory();
}

function generatePagination(pageCount) {
    if (pageCount <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let paginationHtml = `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}">
                <i class="fas fa-chevron-left"></i>
            </a>
        </li>
    `;

    for (let i = 1; i <= pageCount; i++) {
        if (i === 1 || i === pageCount || (i >= currentPage - 1 && i <= currentPage + 1)) {
            paginationHtml += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            paginationHtml += `
                <li class="page-item disabled">
                    <span class="page-link">...</span>
                </li>
            `;
        }
    }

    paginationHtml += `
        <li class="page-item ${currentPage === pageCount ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}">
                <i class="fas fa-chevron-right"></i>
            </a>
        </li>
    `;

    pagination.innerHTML = paginationHtml;

    document.querySelectorAll('.page-link[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const newPage = parseInt(e.currentTarget.dataset.page);
            if (newPage >= 1 && newPage <= pageCount) {
                currentPage = newPage;
                loadHistory();
            }
        });
    });
}

// Overview functions
function loadOverview() {
    const history = JSON.parse(localStorage.getItem('foodHistory') || '[]');
    if (history.length === 0) {
        document.querySelectorAll('#overview-page canvas').forEach(canvas => {
            canvas.style.display = 'none';
            canvas.parentElement.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i> No data available
                </div>
            `;
        });
        return;
    }

    updateStats(history);
    analyzeLocalData(history);
}

async function analyzeLocalData(history) {
    try {
        const analysisData = {
            totalRecords: history.length,
            records: history.slice(-10),
            stats: {
                totalCalories: 0,
                uniqueFoods: new Set(),
                nutritionTypes: new Set(),
                dailyCalories: {},
                nutritionDistribution: {}
            }
        };

        history.forEach(item => {
            if (item?.analysis?.food) {
                const food = item.analysis.food;
                const date = new Date(item.date).toLocaleDateString();
                
                if (food.name) {
                    analysisData.stats.uniqueFoods.add(food.name);
                }
                
                const caloriesMatch = food.calories?.match(/(\d+)\s*(kcal|calories)/i);
                if (caloriesMatch) {
                    const calories = parseInt(caloriesMatch[1]);
                    analysisData.stats.totalCalories += calories;
                    analysisData.stats.dailyCalories[date] = (analysisData.stats.dailyCalories[date] || 0) + calories;
                }
                
                if (food.nutrition) {
                    const nutritionTypes = food.nutrition.match(/(protein|carbohydrates|fat|vitamins|fiber|minerals)/gi) || [];
                    nutritionTypes.forEach(type => {
                        const normalizedType = type.toLowerCase();
                        analysisData.stats.nutritionTypes.add(normalizedType);
                        analysisData.stats.nutritionDistribution[normalizedType] = 
                            (analysisData.stats.nutritionDistribution[normalizedType] || 0) + 1;
                    });
                }
            }
        });

        const dailyCalories = Object.values(analysisData.stats.dailyCalories);
        const avgDailyCalories = dailyCalories.length > 0 
            ? Math.round(dailyCalories.reduce((a, b) => a + b, 0) / dailyCalories.length)
            : 0;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apiKey: API_KEY,
                data: {
                    model: 'qwen-max',
                    input: {
                        messages: [
                            {
                                role: 'system',
                                content: `You are a professional nutritionist. Analyze the dietary records and provide professional advice.
                                Consider:
                                1. Dietary diversity (based on number of different food types)
                                2. Nutritional balance (based on distribution of nutrient types)
                                3. Caloric intake (based on average daily calories)
                                4. Improvement suggestions (specific advice for any deficiencies)
                                Return the analysis in markdown format with these sections:
                                ### Dietary Analysis
                                ### Nutritional Assessment
                                ### Caloric Analysis
                                ### Improvement Suggestions`
                            },
                            {
                                role: 'user',
                                content: JSON.stringify({
                                    totalRecords: analysisData.totalRecords,
                                    uniqueFoods: Array.from(analysisData.stats.uniqueFoods),
                                    nutritionTypes: Array.from(analysisData.stats.nutritionTypes),
                                    nutritionDistribution: analysisData.stats.nutritionDistribution,
                                    totalCalories: analysisData.stats.totalCalories,
                                    avgDailyCalories: avgDailyCalories,
                                    dailyCalories: analysisData.stats.dailyCalories
                                })
                            }
                        ]
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (aiSuggestions) {
            const statsMarkdown = `
### 📊 Data Overview

- Total records: ${analysisData.totalRecords}
- Unique food types: ${Array.from(analysisData.stats.uniqueFoods).join(', ')}
- Total calories: ${analysisData.stats.totalCalories} kcal
- Average daily calories: ${avgDailyCalories} kcal
- Nutrient types covered: ${Array.from(analysisData.stats.nutritionTypes).join(', ')}

`;

            aiSuggestions.innerHTML = marked.parse(statsMarkdown + data.output.text);
        }

        drawCaloriesTrendChart(history);
        drawNutritionChart(history);
        drawFoodTypeChart(history);

    } catch (error) {
        console.error('Data analysis error:', error);
        if (aiSuggestions) {
            aiSuggestions.innerHTML = marked.parse(`
### ❌ Data Analysis Failed

Error: ${error.message}

Please check your connection and try again.
            `);
        }
    }
}

function drawCaloriesTrendChart(history) {
    const caloriesRegex = /(\d+)\s*(kcal|calories)/i;
    const caloriesData = history.map(item => ({
        date: new Date(item.date).toLocaleDateString(),
        calories: parseInt(item.analysis.food.calories.match(caloriesRegex)?.[1] || '0')
    })).filter(item => item.calories > 0);

    const dailyCalories = {};
    caloriesData.forEach(item => {
        dailyCalories[item.date] = (dailyCalories[item.date] || 0) + item.calories;
    });

    const sortedDates = Object.keys(dailyCalories).sort();

    if (caloriesTrendChartInstance) {
        caloriesTrendChartInstance.destroy();
    }

    caloriesTrendChartInstance = new Chart(caloriesTrendChart, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Daily Caloric Intake',
                data: sortedDates.map(date => dailyCalories[date]),
                borderColor: '#36A2EB',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Calories (kcal)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function drawNutritionChart(history) {
    const nutritionKeywords = {
        'Protein': /(protein)/i,
        'Carbohydrates': /(carbohydrates|carbs)/i,
        'Fat': /(fat)/i,
        'Vitamins': /(vitamins)/i,
        'Fiber': /(fiber)/i,
        'Minerals': /(minerals)/i
    };

    const nutritionCount = {};
    Object.keys(nutritionKeywords).forEach(key => {
        nutritionCount[key] = 0;
    });

    history.forEach(item => {
        const nutrition = item.analysis.food.nutrition;
        Object.entries(nutritionKeywords).forEach(([key, regex]) => {
            if (regex.test(nutrition)) {
                nutritionCount[key]++;
            }
        });
    });

    if (nutritionChartInstance) {
        nutritionChartInstance.destroy();
    }

    nutritionChartInstance = new Chart(nutritionChart, {
        type: 'bar',
        data: {
            labels: Object.keys(nutritionCount),
            datasets: [{
                data: Object.values(nutritionCount),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56',
                    '#4BC0C0', '#9966FF', '#FF9F40'
                ]
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Occurrences'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function drawFoodTypeChart(history) {
    const foodTypes = {};
    history.forEach(item => {
        const foodName = item.analysis.food.name || 'Unknown';
        foodTypes[foodName] = (foodTypes[foodName] || 0) + 1;
    });

    const sortedTypes = Object.entries(foodTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
    ];

    if (foodTypeChartInstance) {
        foodTypeChartInstance.destroy();
    }

    foodTypeChartInstance = new Chart(foodTypeChart, {
        type: 'doughnut',
        data: {
            labels: sortedTypes.map(([name]) => name),
            datasets: [{
                data: sortedTypes.map(([, count]) => count),
                backgroundColor: colors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

function updateStats(history) {
    document.getElementById('total-records').textContent = history.length;

    const caloriesRegex = /(\d+)\s*(kcal|calories)/i;
    const calories = history.map(item => {
        try {
            if (!item?.analysis?.food?.calories) return 0;
            const match = item.analysis.food.calories.match(caloriesRegex);
            return match ? parseInt(match[1]) : 0;
        } catch (error) {
            console.error('Calorie parsing error:', error);
            return 0;
        }
    }).filter(cal => cal > 0);
    
    const avgCalories = calories.length > 0 
        ? Math.round(calories.reduce((a, b) => a + b, 0) / calories.length)
        : 0;
    document.getElementById('avg-calories').textContent = avgCalories;

    const uniqueDays = new Set(
        history.map(item => {
            try {
                return new Date(item.date).toLocaleDateString();
            } catch (error) {
                console.error('Date parsing error:', error);
                return null;
            }
        }).filter(Boolean)
    );
    document.getElementById('active-days').textContent = uniqueDays.size;
}