const fetch = require('node-fetch');
const sanitize = require('sanitize-filename');
const fs = require('fs');

// Base url for requests to the site.
const BASEURL = "http://www.omgbeaupeep.com/comics/";
// Time between requests
const REQ_DELAY = 500; // ms

// Grab image url from html
const IMAGE_REGEX = /(?<=^\<\!\-\- End Advertisement \-\-\>\n\<\/div\>\n\<\/td\>\n\<\/tr\>\n\<tr\>\n\<td\>\<a href\=\".*\"\>\<img src\=\").*?(?=" )/m;
// Grab the extension from a url
const EXT_REGEX = /\.[a-zA-Z]*$/;

// matches the many options in the chapter list. gets a lot of <option value="001">001 Chapter Name</option>
const CHAPTER_REGEX = /(?<=\<span\>Select a Book \<select name\=\"chapter\" onchange\=\"change_chapter\((?:\'|\").*?(?:\'|\")\, this\.value\)\"\>).*(?=\<\/select\>\<\/span\>)/m;
// Gets the chapter id from stuff matched by chapter_regex
const CHAPTER_ID_REGEX = /(?<=\<option value=").*?(?=")/g; // .* because some chapters can be stuff like '33.01' and they're might be weird ones out there
// Gets the chapter name from stuff matched by chapter_regex
const CHAPTER_NAME_REGEX = /(?<=\<option value=".*"(?! selected=".*"|\b)\>).*?(?=\<\/option\>)/g;

// matches the many options in the page list. gets lot of <option value="1">#1</option>
const PAGE_REGEX = /(?<=Page \<select name\=\"page\" onchange\=\"change_page\((?:\'|\").*?(?:\'|\"), this\.value\)\"\>).*(?=\<\/select\>)/m;
// gets the page numbers from stuff matched by page_regex
const PAGE_NUM_REGEX = /(?<=\<option value=").*?(?=")/g;
// no need to grab the page names as they're just the same as the nums matched above but with # at the start (1 -> #1 )


function createURL(comic, chapter, page) {
	return BASEURL + comic + "/" + chapter + "/" + page;
}

function makeDirectory(dir) {
	return new Promise((resolve, reject) => fs.mkdir(dir, err => {
		if (err) return reject(err);
		
		console.log("Made", dir);
		
		resolve(dir);
	}));
}

function sleep (time=REQ_DELAY) {
	return new Promise(resolve => setTimeout(() => resolve(), time));
}

function grabComic (comic, outDir) {
	if (!outDir) {
		outDir = "output/" + sanitize(comic);
	}
	
	console.log("Grabbing comic", comic);
	
	return makeDirectory(outDir)
		.then(dir => getChapterList(comic))
		.then(async chapterList => {
			for (let i = 0; i < chapterList.length; i++) {
				await grabChapter(comic, chapterList[i][0], outDir + '/' + sanitize(chapterList[i][1]));
				await sleep(); // wait a short time between each request. makes it appear a little more human and puts a tiny bit less load on the server
			}
		});
}

function getChapterList (comic) {
	const chapterURL = createURL(comic, 1, 1);

	console.log("Getting Chapter List");
	
	return fetch(chapterURL)
		.then(response => response.text())
		.then(html => {
			let chapterHTML = html.match(CHAPTER_REGEX);

			if (chapterHTML !== null && chapterHTML[0]) {
				chapterHTML = chapterHTML[0];
			} else {
				throw new Error("Couldn't grab chapter list from ", chapterURL);
			}

			const chapterIDs = chapterHTML.match(CHAPTER_ID_REGEX);

			if (chapterIDs === null) {
				throw new Error("Couldn't grab chapter ids from", chapterURL);
			}

			const chapterNames = chapterHTML.match(CHAPTER_NAME_REGEX);

			if (chapterNames === null) {
				throw new Error("Couldn't grab chapter names from", chapterURL);
			}

			if (chapterIDs.length !== chapterNames.length) {
				throw new Error("chapterIds had a length of '" + chapterIDs.length + "' chapterNames has a length of '" + chapterNames.length + "'. Responsible url: " + chapterURL);
			}

			let paired = [];
			
			for (let i = 0; i < chapterIDs.length; i++) {
				paired.push([chapterIDs[i], chapterNames[i]]);
			}

			console.log("Retrieved chapter list for", comic);

			return paired;
		});
}

function grabChapter (comic, chapter, outDir) {
	console.log("\tGrabbing chapter", chapter);

	return makeDirectory(outDir)
		.then(dir => getPageNumbers(comic, chapter))
		.then(pageNumbers => {
			let promises = [];
			for (let i = 0; i < pageNumbers.length; i++) {
				promises.push(grabPage(comic, chapter, pageNumbers[i], outDir));
			}

			return Promise.all(promises);
		});
}

function getPageNumbers (comic, chapter, outDir) {
	const pageURL = createURL(comic, chapter, 1);

	return fetch(pageURL)
		.then(response => response.text())
		.then(html => {
			let pageHTML = html.match(PAGE_REGEX);

			if (pageHTML !== null && pageHTML[0]) {
				pageHTML = pageHTML[0];
			} else {
				throw new Error("Couldn't grab page list from ", pageURL);
			}

			const pageNumbers = pageHTML.match(PAGE_NUM_REGEX);

			if (pageNumbers === null) {
				throw new Error("Couldn't grab page numbers from ", pageURL);
			}

			return pageNumbers; // return the array rather than a number, just in case there are missing pages for whatever reason
		});
}

function grabPage (comic, chapter, page, outDir) {
	let imageURL; // store it in this scope so we can access it in other promises easier

	return fetch(createURL(comic, chapter, page))
		.then(response => response.text())
		.then(text => {
			imageURL = text.match(IMAGE_REGEX);
			
			if (imageURL !== null && imageURL[0]) {
				imageURL = imageURL[0];
			} else {
				throw new Error("Couldn't grab image from ", createURL(comic, chapter, page));
			}

			return loadImage(imageURL, false);
		})
		.then(buffer => {
			let ext = imageURL.match(EXT_REGEX);

			if (ext) {
				ext = ext[0];
			} else {
				ext = '';
			}

			return saveFile(outDir + '/' + sanitize(page + ext), buffer);
		})
		.then(dir => {
			console.log("Saved chapter-" + chapter + " page-" + page + " to " + dir);
		})
		.catch(err => {
			console.log("There was an error. Exiting.", err);
			process.exit(1);
		})
}

function loadImage (link, absolute=true) { // gets the buffer for an image
	if (!absolute) {
		link = BASEURL + link;
	}

	console.log(link);

	return fetch(link)
		.then(response => response.buffer());
}

function saveFile (dir, data) {
	return new Promise((resolve, reject) => fs.writeFile(dir, data, (err) => {
			if (err) {
				return reject(err);
			}

			resolve(dir);
		}));
}

module.exports = {
	createURL,
	grabPage,
	saveFile,
	grabChapter,
	grabComic,
	getChapterList,
};