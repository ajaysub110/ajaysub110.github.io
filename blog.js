// Function to load blog list
async function loadBlogList() {
    try {
        const blogListElement = document.querySelector('.blog-list');
        
        // Check if direct access parameter is present in current URL
        const urlParams = new URLSearchParams(window.location.search);
        const directAccess = urlParams.get('direct') === 'true';
        
        // Fetch the blog index file
        const indexResponse = await fetch('assets/blog/index.json');
        
        if (!indexResponse.ok) {
            throw new Error(`Failed to fetch blog index: ${indexResponse.status}`);
        }
        
        const indexData = await indexResponse.json();
        const blogFiles = indexData.blogFiles || [];
        
        if (blogFiles.length === 0) {
            throw new Error('No blog files found in index');
        }
        
        // Sort blog files by date (newest first)
        blogFiles.sort((a, b) => {
            const dateA = a.split('_')[0];
            const dateB = b.split('_')[0];
            return dateB.localeCompare(dateA);
        });
        
        // Process each blog file
        let postsLoaded = 0;
        
        for (const file of blogFiles) {
            try {
                const fileResponse = await fetch(`assets/blog/${file}`);
                
                if (!fileResponse.ok) {
                    console.error(`Failed to load file: ${file}`, fileResponse.status);
                    continue;
                }
                
                const content = await fileResponse.text();
                
                // Parse the blog content
                const lines = content.split('\n');
                const title = lines[0].trim();
                const date = lines[1].trim();
                
                // Create blog entry element
                const blogEntry = document.createElement('div');
                blogEntry.className = 'blog-entry';
                
                // Create link to individual blog post
                const blogLink = document.createElement('a');
                let blogUrl = `blog-post.html?file=${encodeURIComponent(file)}`;
                
                // Add direct access parameter if present in current URL
                if (directAccess) {
                    blogUrl += '&direct=true';
                }
                
                blogLink.href = blogUrl;
                blogLink.className = 'blog-title';
                blogLink.textContent = title;
                
                // Create date element
                const dateElement = document.createElement('span');
                dateElement.className = 'blog-date';
                dateElement.textContent = date;
                
                // Add elements to blog entry
                blogEntry.appendChild(blogLink);
                blogEntry.appendChild(dateElement);
                
                // Add blog entry to list
                blogListElement.appendChild(blogEntry);
                postsLoaded++;
            } catch (error) {
                console.error(`Error loading blog file ${file}:`, error);
            }
        }
        
        if (postsLoaded === 0) {
            throw new Error('No blog posts could be loaded');
        }
        
    } catch (error) {
        console.error('Error loading blog posts:', error);
        document.querySelector('.blog-list').innerHTML = `
            <p>Error loading blog posts: ${error.message}</p>
            <p>If you're viewing this locally, try using a local server:</p>
            <pre>python -m http.server 8000</pre>
            <p>Then visit: <a href="http://localhost:8000">http://localhost:8000</a></p>
        `;
    }
}

// Function to generate a shareable link for a blog post
function getShareableLink(file) {
    // Use the domain name instead of relative paths
    return `https://ajaysubramanian.com/blog-post.html?file=${encodeURIComponent(file)}&direct=true`;
}

// Function to load a single blog post
async function loadBlogPost() {
    try {
        // Get the file parameter from URL
        const urlParams = new URLSearchParams(window.location.search);
        const file = urlParams.get('file');
        
        if (!file) {
            throw new Error('No blog post specified');
        }
        
        // Fetch the blog file
        const response = await fetch(`assets/blog/${file}`);
        if (!response.ok) {
            throw new Error(`Blog post not found (${response.status}: ${response.statusText})`);
        }
        
        const content = await response.text();
        
        // Parse the blog content
        const lines = content.split('\n');
        const title = lines[0].trim();
        const date = lines[1].trim();
        
        // Skip the title and date, then look for the first blank line
        let contentStart = 2; // Start after title and date
        
        for (let i = contentStart; i < lines.length; i++) {
            if (lines[i].trim() === '') {
                contentStart = i + 1;
                break;
            }
        }
        
        const blogContent = lines.slice(contentStart).join('\n');
        
        // Update the page
        document.title = `Ajay Subramanian - ${title}`;
        document.getElementById('blog-title').textContent = title;
        document.getElementById('blog-date').textContent = date;
        
        // Convert plain text to HTML with paragraphs
        const paragraphs = blogContent.split('\n\n').map(p => `<p>${p.trim()}</p>`).join('');
        document.getElementById('blog-content').innerHTML = paragraphs;
        
    } catch (error) {
        console.error('Error loading blog post:', error);
        document.getElementById('blog-title').textContent = 'Error';
        document.getElementById('blog-content').innerHTML = `
            <p>Error loading blog post: ${error.message}</p>
            <p>If you're viewing this locally, try using a local server:</p>
            <pre>python -m http.server 8000</pre>
            <p>Then visit: <a href="http://localhost:8000">http://localhost:8000</a></p>
        `;
    }
} 