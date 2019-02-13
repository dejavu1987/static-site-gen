# INVIQA static-site generator (SSG)

Light weight script to crawl a website to download the static content.

## Features
* Supports all filetypes
* HTMLs are save as index.html if the url doesnt have .html extension.
* Custom handling of query strings
* Ignores mailto, or other protocols than actual http protocol
* Ignores external links
* Supports crawling of static assets JS/CSS.
** CSS from `<link>` tag or `@import`
* Stats at the end
** Number of files downloaded
** Number of files per type
