# Personal Website

This is the personal website of Ajay Subramanian.

## Running Locally

To run the website locally:

1. Make sure you have Python installed on your computer
2. Open a terminal/command prompt
3. Navigate to the website directory
4. Run a simple HTTP server:

```bash
python -m http.server 8000
```

5. Open your browser and go to: http://localhost:8000

## Blog Posts

Blog posts are stored in the `assets/blog` directory as text files. Each blog post file should follow this format:

```
Title of the Blog Post
MM/DD/YYYY

Content of the blog post starts here...

Paragraphs are separated by blank lines.
```

The format is simple:
- First line: Title of the blog post
- Second line: Date in MM/DD/YYYY format
- Third line: A blank line (this separates the header from the content)
- Fourth line and beyond: The content of your blog post

### Adding a New Blog Post

To add a new blog post:

1. Create a new text file in the `assets/blog` directory with the format `MMDDYYYY_Title.txt`
2. Add the blog post content following the format above
3. Update the `blogFiles` array in `assets/blog/index.json` to include the new file name

Example `index.json`:
```json
{
  "blogFiles": [
    "03102025_A-Complimentary-Feast.txt",
    "04152025_My-New-Blog-Post.txt"
  ]
}
```

That's it! No need to modify any JavaScript files.

## Files

- `index.html` - Main page
- `blog.html` - Blog listing page
- `blog-post.html` - Individual blog post page
- `blog.js` - JavaScript for loading blog posts
- `stylesheet.css` - Styles for the website
- `assets/blog/index.json` - List of blog post files
- `assets/blog/*.txt` - Blog post content files 