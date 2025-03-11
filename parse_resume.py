import re
import os

def parse_latex_research_interests(tex_file):
    with open(tex_file, 'r') as f:
        content = f.read()
    
    # Find the Research Interests section
    research_section = re.search(r'\\subsection\*{\\Large Research Interests}.*?\\vspace{1em}', content, re.DOTALL)
    if not research_section:
        return None
    
    # Extract the research interests text
    text = research_section.group(0)
    
    # Clean up LaTeX commands
    clean_text = re.sub(r'\\subsection\*{\\Large Research Interests}', '', text)
    clean_text = re.sub(r'\\vspace{1em}', '', clean_text)
    clean_text = re.sub(r'\\href{(.*?)}{(.*?)}', r'<a href="\1">\2</a>', clean_text)
    clean_text = clean_text.strip()
    
    return clean_text

def parse_latex_publications(tex_file):
    with open(tex_file, 'r') as f:
        content = f.read()
    
    # Find the Publications section
    pub_section = re.search(r'\\subsection\*{\\Large Journal and Conference Publications}(.*?)\\hrule', content, re.DOTALL)
    if not pub_section:
        return []
    
    # Extract individual publications
    pub_items = re.findall(r'\\item (.*?)(?=\\item|\n\s*\n|$)', pub_section.group(1), re.DOTALL)
    
    publications = []
    for item in pub_items:
        # Clean up the item
        item = item.strip()
        if not item:
            continue
            
        # Extract link if present
        link_match = re.search(r'\\href{(.*?)}{.*?}', item)
        link = link_match.group(1) if link_match else None
        
        # Remove LaTeX commands
        clean_text = re.sub(r'\\textbf{(.*?)}', r'\1', item)
        clean_text = re.sub(r'\\href{.*?}{(.*?)}', r'\1', clean_text)
        clean_text = re.sub(r'\\textit{(.*?)}', r'\1', clean_text)
        clean_text = re.sub(r'\\emph{(.*?)}', r'\1', clean_text)
        
        publications.append({
            'text': clean_text.strip(),
            'link': link
        })
    
    return publications

def generate_html(publications):
    html = '<h3>Publications</h3>\n<ul class="publications">\n'
    
    for pub in publications:
        # Extract title, authors, and venue
        text = pub['text']
        
        # Try to extract title, authors, and venue
        parts = text.split('.')
        title = parts[0].strip()
        authors = parts[1].strip() if len(parts) > 1 else ""
        venue = '.'.join(parts[2:]).strip() if len(parts) > 2 else ""
        
        # Extract year if present
        year_match = re.search(r'\((\d{4})\)', text)
        year = year_match.group(1) if year_match else ""
        
        # Format the publication
        html += '    <li>\n'
        html += '        <div class="pub-title">\n'
        
        if pub['link']:
            html += f'            <a href="{pub["link"]}">{title}</a>\n'
        else:
            html += f'            <span>{title}</span>\n'
        
        html += f'            <span class="pub-year">{year}</span>\n'
        html += '        </div>\n'
        html += f'        <span class="pub-authors">{authors}</span>\n'
        html += f'        <span class="pub-venue">{venue}</span>\n'
        html += '    </li>\n'
    
    html += '</ul>\n'
    return html

def update_index_html(publications_html, research_interests):
    with open('index.html', 'r') as f:
        content = f.read()
    
    # Replace the existing research interests section
    if research_interests:
        content = re.sub(
            r'<h3>Research</h3>\s*<p>.*?</p>',
            f'<h3>Research</h3>\n\t\t<p>\n\t\t\t{research_interests}\n\t\t</p>',
            content,
            flags=re.DOTALL
        )
    
    # Replace the existing publications section
    new_content = re.sub(
        r'<h3>Publications</h3>\s*<ul class="publications">.*?</ul>',
        publications_html.strip(),
        content,
        flags=re.DOTALL
    )
    
    with open('index.html', 'w') as f:
        f.write(new_content)

def main():
    # Parse research interests and publications from resume.tex
    research_interests = parse_latex_research_interests('assets/resume.tex')
    publications = parse_latex_publications('assets/resume.tex')
    
    # Generate HTML
    html = generate_html(publications)
    
    # Update index.html
    update_index_html(html, research_interests)

if __name__ == '__main__':
    main() 