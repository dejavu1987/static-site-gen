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


## Installation

1. Clone the repo
2. run `npm install`

## Usage

1. `node index <options>`

### Options

#### host

The hostname
```
node index --host=example.com
```

#### Destination

The folder name under /static where the downloaded files are saved
```
node index --dest=NewWebsite
```

#### Concurrencies

Request parallelly
```
node index --cc=10
```

#### Delay

Waits for milliseconds before queuing new urls
```
node index --delay=200
```
