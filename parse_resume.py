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
        
        # Remove LaTeX commands first to make parsing easier
        clean_text = re.sub(r'\\textbf{(.*?)}', r'\1', item)
        clean_text = re.sub(r'\\href{.*?}{(.*?)}', r'\1', clean_text)
        clean_text = re.sub(r'\\textit{(.*?)}', r'\1', clean_text)
        clean_text = re.sub(r'\\emph{(.*?)}', r'\1', clean_text)
        
        # Split by periods to get parts
        parts = clean_text.split('.')
        
        # Try to extract parts based on the year
        year_match = re.search(r'\((\d{4})\)', clean_text)
        if year_match and len(parts) >= 2:
            # Find which part contains the year
            year_part_index = -1
            for i, part in enumerate(parts):
                if '(' + year_match.group(1) + ')' in part:
                    year_part_index = i
                    break
            
            if year_part_index != -1:
                # Get all authors (everything before the year part)
                authors_parts = parts[:year_part_index]
                authors = '. '.join(authors_parts).strip()
                if authors.endswith('.'):
                    authors = authors[:-1]
                
                # Title is in the part after the year
                if year_part_index < len(parts) - 1:
                    title = parts[year_part_index + 1].strip()
                else:
                    title = "Unknown Title"
                
                # Extract just the venue name without the year
                venue = ""
                if year_part_index < len(parts):
                    # Get the part with the year
                    year_part = parts[year_part_index]
                    
                    # Remove the year and parentheses
                    venue = re.sub(r'\(\d{4}\)', '', year_part).strip()
                    
                    # Remove "Also presented at" and anything after it
                    venue = re.sub(r'Also presented at.*', '', venue).strip()
                    
                    # Remove "Link" and anything after it
                    venue = re.sub(r'Link:.*', '', venue).strip()
                    venue = re.sub(r'Link .*', '', venue).strip()
                    
                    # Remove leading period if present
                    venue = venue.lstrip('.')
                    venue = venue.strip()
                    
                    # If there are additional venue parts, add them
                    if year_part_index + 2 < len(parts):
                        # Check if the next parts contain "Also presented" or "Link"
                        additional_parts = []
                        for part in parts[year_part_index + 2:]:
                            part = part.strip()
                            if "Also presented" not in part and not part.startswith("Link"):
                                additional_parts.append(part)
                            else:
                                break
                        
                        if additional_parts:
                            # Join without adding periods
                            additional_venue = ". ".join(additional_parts)
                            # Only add if we have a venue already
                            if venue:
                                venue += ". " + additional_venue
                            else:
                                venue = additional_venue
                
                publications.append({
                    'title': title,
                    'authors': authors,
                    'venue': venue,
                    'year': year_match.group(1),
                    'link': link
                })
            else:
                # Fallback if we can't parse correctly
                publications.append({
                    'text': clean_text.strip(),
                    'link': link
                })
        else:
            # Fallback if no year found or not enough parts
            publications.append({
                'text': clean_text.strip(),
                'link': link
            })
    
    return publications

def generate_html(publications):
    html = '<h3>Publications</h3>\n<ul class="publications">\n'
    
    for pub in publications:
        html += '    <li>\n'
        
        if 'title' in pub:
            # Display title first
            html += '        <div class="pub-title">\n'
            if pub['link']:
                html += f'            <a href="{pub["link"]}">{pub["title"]}</a>\n'
            else:
                html += f'            <span>{pub["title"]}</span>\n'
            
            # Add year if available
            if 'year' in pub:
                html += f'            <span class="pub-year">({pub["year"]})</span>\n'
            
            html += '        </div>\n'
            
            # Display authors and venue
            html += f'        <span class="pub-authors">{pub["authors"]}</span>\n'
            html += f'        <span class="pub-venue">{pub["venue"]}</span>\n'
        else:
            # Fallback to original format if parsing failed
            if pub['link']:
                html += f'        <a href="{pub["link"]}">{pub["text"]}</a>\n'
            else:
                html += f'        <span>{pub["text"]}</span>\n'
        
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