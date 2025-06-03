// script.js

document.addEventListener('DOMContentLoaded', () => {
    const postsContainer = document.getElementById('posts-container');
    const searchInput = document.getElementById('searchInput');
    const postCountElement = document.getElementById('post-count');
    const noResultsElement = document.getElementById('no-results');

    // 총 게시물 수 표시
    postCountElement.textContent = posts.length;

    // 텍스트에서 검색어를 찾아 하이라이트하는 함수
    function highlightText(text, searchTerm) {
        if (!searchTerm.trim()) {
            return text;
        }
        const words = searchTerm.toLowerCase().split(/\s+/).filter(word => word.length > 0);
        let highlightedText = text;

        words.forEach(word => {
            const regex = new RegExp(word, 'gi');
            highlightedText = highlightedText.replace(regex, '<span class="highlight">$&</span>');
        });
        return highlightedText;
    }

    // 게시물 목록을 화면에 표시하는 함수
    function displayPosts(postsToDisplay, searchTerm = '') {
        postsContainer.innerHTML = '';

        if (postsToDisplay.length === 0) {
            noResultsElement.classList.remove('hidden');
            postsContainer.classList.add('hidden');
        } else {
            noResultsElement.classList.add('hidden');
            postsContainer.classList.remove('hidden');
        }


        var adSlots = ['8076406309', '5716167978', '4346487815'];
        for (var i = 0; i < postsToDisplay.length; i++) {
            post = postsToDisplay[i]

            const postElement = document.createElement('article');
            postElement.classList.add('post');
            const highlightedTitle = highlightText(post.title, searchTerm);
            const snippet = post.content.substring(0, 150) + (post.content.length > 150 ? '...' : '');
            const id = post.id;
            const highlightedSnippet = highlightText(snippet, searchTerm);
            postElement.style = "cursor: pointer;"
            postElement.onclick = function() {
                location.href= `collects/q${id}.html`;
            }

            postElement.innerHTML = `
                <h2>${highlightedTitle}</h2>
                <div class="post-meta">
                    <span>작성일: ${post.date}</span>
                </div>
                <div class="post-content">
                    <p>${highlightedSnippet}</p>
                </div>
            `;
            postsContainer.appendChild(postElement);
            if (i == 2 || i == 3 || i == 5) {
                var adDiv = document.createElement('div');
                adDiv.style = 'text-align: center; margin: 15px 0; height: 150px;';
                var adSlot = adSlots[i % adSlots.length];
                adDiv.innerHTML = '<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-6836676689902404" data-ad-slot="' + adSlot + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
                postElement.appendChild(adDiv);
                (adsbygoogle = window.adsbygoogle || []).push({});
            }
        }
    }

    // 검색 로직 함수
    function searchPosts() {
        const searchTerm = searchInput.value.toLowerCase();

        if (!searchTerm.trim()) {
            displayPosts(posts);
            return;
        }

        const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);

        // --- 여기서부터 핵심 로직 변경 ---

        // 1. 각 게시물의 점수를 계산
        const scoredPosts = posts.map(post => {
            let score = 0;
            const lowerCaseTitle = post.title.toLowerCase();
            const lowerCaseContent = post.content.toLowerCase();

            searchWords.forEach(word => {
                // 제목에 포함되면 2점 (가중치 부여)
                if (lowerCaseTitle.includes(word)) {
                    score += 2;
                } 
                // 내용에만 포함되면 1점
                else if (lowerCaseContent.includes(word)) {
                    score += 1;
                }
            });
            // 원래 post 데이터와 계산된 점수를 함께 반환
            return { ...post, score };
        });

        // 2. 점수가 0보다 큰 게시물만 필터링
        const filteredPosts = scoredPosts.filter(post => post.score > 0);

        // 3. 점수가 높은 순으로 정렬 (내림차순 정렬)
        filteredPosts.sort((a, b) => b.score - a.score);

        // --- 로직 변경 끝 ---

        displayPosts(filteredPosts, searchTerm);
    }

    // 검색창에 입력할 때마다 searchPosts 함수 실행
    searchInput.addEventListener('input', searchPosts);

    // 페이지가 처음 로드될 때 모든 게시물 표시
    displayPosts(posts);
});
