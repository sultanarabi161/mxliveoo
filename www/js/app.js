// কনফিগারেশন
const M3U_URL = "https://m3u.ch/pl/b3499faa747f2cd4597756dbb5ac2336_e78e8c1a1cebb153599e2d938ea41a50.m3u"; 
// দ্রষ্টব্য: CORS সমস্যা এড়াতে 'cors-anywhere' বা আপনার নিজস্ব প্রক্সি ব্যবহার করা ভালো। অ্যাপে বিল্ড করার পর সরাসরি লিংকেও কাজ করতে পারে যদি হোস্টিং পারমিশন দেয়।
const NOTICE_JSON_URL = "https://raw.githubusercontent.com/sultanarabi161/mxliveoo/refs/heads/main/notice.json"; 

let allChannels = [];
let currentCategory = "All";
let hls = null;

document.addEventListener('deviceready', initApp, false);
// ব্রাউজারে টেস্টিং এর জন্য:
window.onload = initApp;

function initApp() {
    fetchNotice();
    loadM3U();
    
    // ইভেন্ট লিসেনার
    document.getElementById('searchBtn').onclick = () => {
        const bar = document.getElementById('searchBar');
        bar.style.display = bar.style.display === 'none' ? 'block' : 'none';
    };
    
    document.getElementById('searchInput').addEventListener('input', (e) => {
        renderChannels(e.target.value);
    });

    document.getElementById('infoBtn').onclick = () => {
        document.getElementById('infoModal').style.display = 'flex';
    };
}

// 1. Notice Fetch Logic
async function fetchNotice() {
    try {
        const res = await fetch(NOTICE_JSON_URL);
        const data = await res.json();
        if(data.message) {
            document.getElementById('noticeMsg').innerText = data.message;
        }
    } catch (e) {
        console.log("Notice Error", e);
        document.getElementById('noticeMsg').innerText = "Welcome to mxliveoo Live TV!";
    }
}

// 2. M3U Parser Logic
async function loadM3U() {
    try {
        const response = await fetch(M3U_URL);
        const text = await response.text();
        parseM3U(text);
    } catch (e) {
        document.getElementById('channelGrid').innerHTML = '<div style="grid-column: span 4; text-align:center;">Failed to load channels. Check internet.</div>';
    }
}

function parseM3U(data) {
    const lines = data.split('\n');
    let currentChannel = {};
    
    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('#EXTINF')) {
            // লোগো এক্সট্রাক্ট
            const logoMatch = line.match(/tvg-logo="([^"]*)"/);
            const logo = logoMatch ? logoMatch[1] : 'img/default_tv.png';
            
            // গ্রুপ/ক্যাটাগরি এক্সট্রাক্ট
            const groupMatch = line.match(/group-title="([^"]*)"/);
            const group = groupMatch ? groupMatch[1] : 'Others';
            
            // নাম এক্সট্রাক্ট (কমা এর পর থেকে)
            const name = line.split(',').pop().trim();
            
            currentChannel = { name, logo, group };
        } else if (line.startsWith('http')) {
            currentChannel.url = line;
            allChannels.push(currentChannel);
        }
    });
    
    setupCategories();
    renderChannels();
}

function setupCategories() {
    const categories = ['All', ...new Set(allChannels.map(c => c.group))];
    const catList = document.getElementById('categoryList');
    catList.innerHTML = categories.map(cat => 
        `<button onclick="filterCategory('${cat}')" class="${cat === 'All' ? 'active' : ''}">${cat}</button>`
    ).join('');
}

function filterCategory(cat) {
    currentCategory = cat;
    // বাটন হাইলাইট আপডেট
    document.querySelectorAll('.categories button').forEach(btn => {
        btn.classList.remove('active');
        if(btn.innerText === cat) btn.classList.add('active');
    });
    renderChannels();
}

// 3. Render Channels (Grid)
function renderChannels(searchTerm = "") {
    const grid = document.getElementById('channelGrid');
    grid.innerHTML = "";
    
    const filtered = allChannels.filter(ch => {
        const matchCat = currentCategory === 'All' || ch.group === currentCategory;
        const matchSearch = ch.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchCat && matchSearch;
    });
    
    if(filtered.length === 0) {
        grid.innerHTML = '<p style="grid-column: span 4; text-align:center;">No channels found.</p>';
        return;
    }

    filtered.forEach(ch => {
        const card = document.createElement('div');
        card.className = 'channel-card';
        card.innerHTML = `
            <img src="${ch.logo}" onerror="this.src='https://via.placeholder.com/100?text=TV'">
            <p>${ch.name}</p>
        `;
        card.onclick = () => openPlayer(ch);
        grid.appendChild(card);
    });
}

// 4. Player Logic
function openPlayer(channel) {
    const playerScreen = document.getElementById('playerScreen');
    const video = document.getElementById('videoPlayer');
    document.getElementById('playingTitle').innerText = channel.name;
    
    playerScreen.style.display = 'block';
    
    // HLS সেটআপ
    if (Hls.isSupported()) {
        if(hls) hls.destroy();
        hls = new Hls();
        hls.loadSource(channel.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            video.play();
        });
        hls.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                console.log("Player Error: Retrying...");
                hls.startLoad();
            }
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = channel.url;
        video.play();
    }
    
    // Related Channels Render
    renderRelated(channel.group);
}

function renderRelated(group) {
    const relatedGrid = document.getElementById('relatedGrid');
    relatedGrid.innerHTML = "";
    const related = allChannels.filter(c => c.group === group).slice(0, 8); // প্রথম ৮টি
    
    related.forEach(ch => {
        const div = document.createElement('div');
        div.className = 'channel-card';
        div.innerHTML = `
            <img src="${ch.logo}" onerror="this.src='https://via.placeholder.com/50'">
            <p>${ch.name}</p>
        `;
        div.onclick = () => {
            // প্লেয়ার রিলোড না করে শুধু সোর্স চেঞ্জ
            document.getElementById('playingTitle').innerText = ch.name;
            if(hls) {
                hls.loadSource(ch.url);
                hls.attachMedia(document.getElementById('videoPlayer'));
            }
        };
        relatedGrid.appendChild(div);
    });
}

function closePlayer() {
    document.getElementById('playerScreen').style.display = 'none';
    const video = document.getElementById('videoPlayer');
    video.pause();
    if(hls) hls.destroy();
}

// Info Modal Close
function closeInfo() {
    document.getElementById('infoModal').style.display = 'none';
}
