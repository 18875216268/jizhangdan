// Firebase 配置和初始化
const firebaseConfig = {
    apiKey: "AIzaSyB-pZD5Mb8pejzBr3ZuHoFkJipzSWLJCpo",
    authDomain: "jizhang-2e89a.firebaseapp.com",
    databaseURL: "https://jizhang-2e89a-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "jizhang-2e89a",
    storageBucket: "jizhang-2e89a.firebasestorage.app",
    messagingSenderId: "849349607897",
    appId: "1:849349607897:web:e0eb3a2222cac60d3b99c8",
    measurementId: "G-SYL25YT9ZC"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 全局函数：切换模态框显示
function toggleModal(modalId, show) {
    if (modalId === 'shareModal' && show) {
        updateShareSelections(); // 打开“分享选择”模态框前更新选项
    }
    document.getElementById(modalId).style.display = show ? 'block' : 'none';
}

// 全局函数：切换选中状态
function toggleSelection(element) {
    element.classList.toggle('selected');
}

// 全局变量缓存DOM
const elements = {
    form: null,
    name: null,
    namegive: null,
    money: null,
    what: null,
    why: null,
    toastMessage: null,
    shareSelections: null,
    newName: null,
};

// 新增：鼠标和触屏滑动多选支持
let isDragging = false;

// 确认分摊人选择
function confirmShare() {
    const selected = [...document.querySelectorAll('.select-item.selected')]
        .map(item => item.dataset.name)
        .join(',');
    elements.namegive.value = selected;
    toggleModal('shareModal', false);
}

async function addNewName() {
    const names = elements.newName.value.trim();
    if (!names) {
        showToast('请输入姓名！');
        return;
    }

    // 分隔名字，支持中英文逗号
    const nameList = names.split(/[,，]+/).map(name => name.trim()).filter(name => name);

    try {
        // 从数据库加载当前已存在的名字
        const snapshot = await db.ref('users').once('value');
        const existingNames = [];
        snapshot.forEach(child => {
            const name = child.val().name;
            if (name) existingNames.push(name);
        });

        // 初始化添加逻辑
        const uniqueNames = [];
        const duplicateNames = [];

        nameList.forEach(name => {
            if (existingNames.includes(name)) {
                duplicateNames.push(name); // 已存在的名字
            } else {
                uniqueNames.push(name); // 需要添加的名字
            }
        });

        // 将不重复的名字写入数据库
        if (uniqueNames.length > 0) {
            const updates = {};
            uniqueNames.forEach(name => {
                const newRef = db.ref('users').push();
                updates[newRef.key] = { name };
            });

            await db.ref('users').update(updates);
        }

        // 提示结果
        if (duplicateNames.length > 0) {
            showToast(`${duplicateNames.join(',')} 已添加，无需重复添加！`);
        } else {
            showToast('添加成功');
        }

        // 清空输入框并刷新列表
        elements.newName.value = '';
        await loadNames();
        toggleModal('settingsModal', false);

    } catch (error) {
        showToast(`添加失败：${error.message}`);
    }
}

async function deleteName() {
    const names = elements.newName.value.trim();
    if (!names) {
        showToast('请输入要删除的姓名！');
        return;
    }

    // 分隔名字，支持中英文逗号
    const nameList = names.split(/[,，]+/).map(name => name.trim()).filter(name => name);

    try {
        // 从数据库加载当前的名字列表
        const snapshot = await db.ref('users').once('value');
        const existingNames = {};
        snapshot.forEach(child => {
            const name = child.val().name;
            if (name) existingNames[child.key] = name;
        });

        // 找到需要删除的名字和未找到的名字
        const updates = {};
        const notFoundNames = [];

        nameList.forEach(name => {
            const matchedKey = Object.keys(existingNames).find(
                key => existingNames[key] === name
            );
            if (matchedKey) {
                updates[matchedKey] = null; // 标记删除
            } else {
                notFoundNames.push(name); // 未找到的名字
            }
        });

        // 执行删除操作
        if (Object.keys(updates).length > 0) {
            await db.ref('users').update(updates);
        }

        // 提示结果
        if (notFoundNames.length > 0) {
            showToast(`${notFoundNames.join(',')} 未找到！`);
        } else {
            showToast('删除成功');
        }

        // 清空输入框并刷新列表
        elements.newName.value = '';
        await loadNames();
        toggleModal('settingsModal', false); // 关闭设置弹窗

    } catch (error) {
        showToast(`删除失败：${error.message}`);
    }
}

// 提示消息
function showToast(message) {
    const toast = elements.toastMessage;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// 加载用户名列表
async function loadNames() {
    try {
        const snapshot = await db.ref('users').once('value');
        const names = [];
        snapshot.forEach(child => {
            const name = child.val().name;
            if (name) names.push(name);
        });

        // 更新下拉列表
        elements.name.innerHTML = '<option value="">请选择姓名</option>' +
            names.map(name => `<option value="${name}">${name}</option>`).join('');

        // 初始化分享选择的逻辑
        updateShareSelections();
    } catch (error) {
        console.error('加载用户名失败:', error);
    }
}

// 更新“分享选择”多选框列表
function updateShareSelections() {
    const currentUserName = elements.name.value; // 获取当前用户的姓名
    const shareSelections = document.getElementById('shareSelections');

    db.ref('users').once('value').then(snapshot => {
        const names = [];
        snapshot.forEach(child => {
            const name = child.val().name;
            if (name && name !== currentUserName) { // 排除当前用户名
                names.push(name);
            }
        });

        // 更新多选列表
        shareSelections.innerHTML = names.map(name => `
            <div class="select-item" data-name="${name}">${name}</div>
        `).join('');

        // 重新绑定滑动选择功能
        initMultiSelect();
    }).catch(error => {
        console.error('更新分享选择列表失败:', error);
    });
}

// 新增：初始化多选滑动功能
function initMultiSelect() {
    const selectItems = document.querySelectorAll('.select-item');

    // 鼠标按下时开启拖动模式
    selectItems.forEach(item => {
        item.addEventListener('mousedown', () => {
            isDragging = true;
            toggleSelection(item); // 立即选中当前块
        });

        // 鼠标经过时选中
        item.addEventListener('mousemove', () => {
            if (isDragging) {
                toggleSelection(item);
            }
        });

        // 触屏滑动选中
        item.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (target && target.classList.contains('select-item')) {
                toggleSelection(target);
            }
        });
    });

    // 鼠标松开时关闭拖动模式
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // 触屏结束时关闭拖动模式
    document.addEventListener('touchend', () => {
        isDragging = false;
    });
}

// 表单提交处理
document.addEventListener('DOMContentLoaded', () => {
    elements.form = document.getElementById('expenseForm');
    elements.name = document.getElementById('name');
    elements.namegive = document.getElementById('namegive');
    elements.money = document.getElementById('money');
    elements.what = document.getElementById('what');
    elements.why = document.getElementById('why');
    elements.toastMessage = document.getElementById('toastMessage');
    elements.shareSelections = document.getElementById('shareSelections');
    elements.newName = document.getElementById('newName');

    // 初始化时禁用“您和谁一起分摊”输入框
    elements.namegive.disabled = true;

    // 监听“您的姓名”输入框变化
    elements.name.addEventListener('change', () => {
        if (elements.name.value) {
            elements.namegive.disabled = false; // 启用输入框
        } else {
            elements.namegive.disabled = true; // 禁用输入框
            elements.namegive.value = ''; // 清空“您和谁一起分摊”输入框的值
        }
    });

    elements.form.addEventListener('submit', async (e) => {
        e.preventDefault();
    
        // 获取当前时间并格式化为 "yyyy/mm/dd hh:mm"
        const now = new Date();
        const formattedDate = now.getFullYear() + '/' + 
                              String(now.getMonth() + 1).padStart(2, '0') + '/' + 
                              String(now.getDate()).padStart(2, '0') + ' ' + 
                              String(now.getHours()).padStart(2, '0') + ':' + 
                              String(now.getMinutes()).padStart(2, '0');
    
        // 计算分摊人数（包括自己）
        const totalPeople = elements.namegive.value ? elements.namegive.value.split(',').length + 1 : 1;
    
        // 更新 avgmoney 的逻辑：money 除以 totalPeople
        const avgmoney = parseFloat(elements.money.value) / totalPeople;
    
        // 构造提交的数据
        const formData = {
            name: elements.name.value,
            namegive: elements.namegive.value,
            money: parseFloat(elements.money.value),
            avgmoney: avgmoney.toFixed(2), // 使用新的逻辑计算 avgmoney
            number: totalPeople, // 新增字段，分摊人数
            what: elements.what.value,
            why: elements.why.value,
            date: formattedDate // 时间字段
        };
    
        try {
            // 写入数据库
            await db.ref('expenses').push().set(formData);
            elements.form.reset();
    
            // 提交后重置状态
            elements.namegive.disabled = true;
            elements.name.value = '';
            elements.namegive.value = '';
    
            showToast('提交成功');
        } catch (error) {
            showToast(`提交失败：${error.message}`);
        }
    });

    // 初始化加载
    loadNames();
});
