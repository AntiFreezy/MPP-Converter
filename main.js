const html = {
	lessShifting: document.querySelector("#lessShift"),
	removeOct: document.querySelector("#octaves"),
	mergeSec: document.querySelector("#merge"),
	transpose: document.querySelector("#transpose"),
	minVol: document.querySelector("#minVol"),
	simplify: document.querySelector("#simplify"),
	normalize: document.querySelector("#normalize"),
	removeChords: document.querySelector("#chords"),
	uploadFile: document.querySelector("#upload"),
	convBtn: document.querySelector("#conv"),
	result: document.querySelector("#result")
}

html.result.value = "NoteConverter v1.31. Coded by Boss :P\n\nRewritten in JavaScript by AntiFreez.";

let savedEvent = null;
let lastUsedShift = 0;

html.uploadFile.addEventListener("change", evt => {
	const file = evt.target.files.item(0);
	if (file) {
		const reader = new FileReader();
		reader.readAsArrayBuffer(file);
		reader.onload = (evt) => {
			try {
				const buffer = evt.target.result;
				const midiFile = new MIDIFile(buffer);
				window.fMidi = midiFile;
				const events = midiFile.getMidiEvents();
				savedEvent = events;
			} catch(err) {
				console.error(err);
				html.result.value = "This midi is invalid and cannot be read.";
			}
		}
	}
});


document.addEventListener('dragover', evt => {
	evt.stopPropagation();
	evt.preventDefault();
	evt.dataTransfer.dropEffect = 'copy';
});

document.addEventListener('drop', evt => {
	evt.stopPropagation();
	evt.preventDefault();
	
	const file = evt.dataTransfer.files.item(0);
	if (file) {
		const reader = new FileReader();
		reader.readAsArrayBuffer(file);
		reader.onload = (evt) => {
			try {
				const buffer = evt.target.result;
				const midiFile = new MIDIFile(buffer);
				window.fMidi = midiFile;
				const events = midiFile.getMidiEvents();
				savedEvent = events;
			} catch(err) {
				console.error(err);
				html.result.value = "This midi is invalid and cannot be read.";
			}
		}
	}
});

html.convBtn.addEventListener("click", evt => {
	if (savedEvent != null) {
		convert();
	}
});


let isResultFocus = false;
html.result.addEventListener("focus", evt => {
	if (isResultFocus) return;
	isResultFocus = true;
	result.select();
});

html.result.addEventListener("blur", evt => {
	isResultFocus = false;
});



const notes = [ 'a', 'z', 's', 'x', 'c', 'f', 'v', 'g', 'b', 'n', 'j', 'm', 'k', 'q', '2', 'w', 'e', '4', 'r', '5', 't', 'y', '7', 'u', '8', 'i', '9', 'o', 'p', '-', '[', '=', ']' ];
const upper = [ 'A', 'Z', 'S', 'X', 'C', 'F', 'V', 'G', 'B', 'N', 'J', 'M', 'K', 'Q', '@', 'W', 'E', '$', 'R', '%', 'T', 'Y', '&', 'U', '*', 'I', '(', 'O', 'P', '_', '{', '+', '}' ];


function convert() {
	let output = '';
	let lessShifting = html.lessShifting.checked,
		removeOct = html.removeOct.checked,
		mergeSec = parseFloat(html.mergeSec.value, 10),
		transpose = parseInt(html.transpose.value, 10),
		minVol = parseFloat(html.minVol.value, 10),
		simplify = html.simplify.checked,
		normalize = html.normalize.checked,
		removeChords = html.removeChords.checked;




	if (isNaN(mergeSec)) output += '\nCould not parse Merge (Seconds).';
	if (isNaN(transpose)) output += '\nCould not parse Transpose.';
	if (isNaN(minVol)) output += '\nCould not parse Min Volume.';
	if (simplify && (transpose % 12 != 0)) {
		output += "\nTranspose cannot be active at the same time as simplify unless transpose is a multiple of 12.";
	}

	if (output.length) {
		html.result.value = output.slice(1);
		return;
	}

	let lastNoteTime = -1e10;
	let channels = {};
	let midi = [];

	mergeSec *= 1000;

	for(let note of savedEvent) {
		if (note.subtype == 9 && note.channel != 9 && note.type == 8) {
			if(note.param2 / 127 >= minVol) {
				note.playTime = Math.round(note.playTime);
				let data = {note: note.param1, channel: note.channel};
				if (!channels[note.channel]) channels[note.channel] = [];
				channels[note.channel].push(data);
				if((note.playTime - lastNoteTime) > mergeSec && note.playTime != lastNoteTime) {
					if (!midi[note.playTime]) midi[note.playTime] = [];
					midi[note.playTime].push(data);
					lastNoteTime = note.playTime;
				}
				else {
					midi[lastNoteTime].push(data);
				}
			}
		}
	}

	lastUsedShift = 0;

	channels = Object.values(channels);
	let keySig = new Array(12).fill(0);
	let averages = new Array(channels.length).fill(0);
	let average = 0;
	let total = 0;
	let nonZeroes = 0;
	let currentTrack = 0;
	let sum;

	for (let track of channels) {
		const size = track.length;
		track.forEach(data => {
			keySig[data.note % 12] += 1;
			averages[currentTrack] += data.note;
		});

		total += size;
		average += averages[currentTrack];

		if (size != 0) averages[currentTrack] /= size;
		if (averages[currentTrack] != 0) nonZeroes++;

		let best = 0;
		let highest = 0;
		if (simplify) {
			for (let i = 0; i < 12; i++) {
				sum = keySig[(i % 12)] + keySig[((i + 2) % 12)] + keySig[((i + 4) % 12)] + keySig[((i + 5) % 12)] + keySig[((i + 7) % 12)] + keySig[((i + 9) % 12)] + keySig[((i + 11) % 12)];
				if (sum > highest) {
					highest = sum;
					best = i;
				}
			}
		}
		if (best != 0) {
			if (transpose % 12 != 0) transpose = 0;
			if (Math.abs(best) < 6) transpose -= best;
			else transpose += 12 - best;
		}
		currentTrack++;
	}

	if(total != 0) average /= total;

	let min = 0;

	for (let i = 1; i < averages.length; i++) {
		if (((averages[i] < averages[min]) && (averages[i] != 0)) || (averages[min] == 0)) {
			min = i;
		}
	}

	let trackTransposes = new Array(channels.length).fill(0);

	if (normalize) {
		if (nonZeroes > 1) {
			trackTransposes[min] += 12;
		}
		for (let i = 0; i < averages.length; i++) {
			let dir = average - averages[i];
			if (dir != 0) {
				dir = Math.abs(dir) / dir * 12;
				while (Math.abs(average - averages[i] - trackTransposes[i]) > 12) {
					trackTransposes[i] += dir;
				}
			}
		}
	}

	midi.forEach(arr => {
		arr = arr.map(data => data.note + transpose + trackTransposes[data.channel] - 12);
		arr = [...new Set(arr.sort())];
		if (removeOct) {
			let taken = [];
			arr = arr.reverse().filter(note => {
				if (taken[note % 12]) {
					return false;
				}
				taken[note % 12] = true;
				return true;
			}).reverse();
		}

		if (removeChords) {
			let note = arr.slice(-1)[0];
			arr = [note];
		}

		let idealShift = 0;
		let lowestNote = arr[0] + 24 - 56;
		let highestNote = arr.slice(-1)[0] + 24 - 56;

		arr.forEach(note => {
			note -= 32;
			let necessaryShift = note >= notes.length ? ((note - notes.length) / 12 + 1)^0 : note < 0 ? ((note + 1) / 12 - 1)^0 : 0;
			if (necessaryShift != 0) {
				if (necessaryShift > 0) {
					idealShift = Math.max(necessaryShift, idealShift);
				} else if (idealShift <= 0) {
					idealShift = Math.min(necessaryShift, idealShift);
				}
			}
		});
		if (((lessShifting) && (lowestNote >= 12 * lastUsedShift) && (highestNote < notes.length + 12 * lastUsedShift) && (lastUsedShift > 0)) || ((lowestNote >= 12 * lastUsedShift) && (highestNote < notes.length + 12 * lastUsedShift) && (lastUsedShift < 0))) {
			idealShift = lastUsedShift;
		}
		arr.forEach(note => {
			let lastLastUsedShift = lastUsedShift;
			let newNote = printKey(note, idealShift);
			if ((lastUsedShift != lastLastUsedShift) && (lastUsedShift != idealShift)) {
				newNote = printKey(note, lastLastUsedShift);
			}
			output += newNote;
		});
		output += " ";
	});

	html.result.value = output;
}


function printKey(n, shifting) {
	let note = n - 56 + 24;
	let steps = shifting * 12;
	if (shifting == 0) {
		let necessaryShift = note >= notes.length ? ((note - notes.length) / 12 + 1)^0 : note < 0 ? ((note + 1) / 12 - 1)^0 : 0;
		return modifyShift(note - necessaryShift * 12, necessaryShift);
	}
	let modified = note - steps;
	if (modified != 0) {
		let dir = Math.abs(modified) / modified;
		while ((modified < 0) || (modified >= notes.length)) {
			shifting += dir;
			modified -= 12 * dir;
		}
	}
	return modifyShift(modified, shifting);
}

function modifyShift(index, shift) {
	lastUsedShift = shift;
	let old = !location.hash.includes("#new");
	try {
		switch (shift) {
			case 0: 
				return notes[index];
			case 1: 
				return upper[index];
			case 2: 
				return old ? upper[index] + "`" : "`" + upper[index];
			case 3: 
				return old ? upper[index] + "\"" : "\"" + upper[index];
			case -1: 
				return old ? notes[index] + "\"" : "\"" + notes[index];
			case -2: 
				return old ? notes[index] + "`" : "`" + notes[index];
		}
	}
	catch (e) {}
	return "";
}