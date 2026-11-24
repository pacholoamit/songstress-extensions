// Written by "pnpm --dir packages/extensions fixtures:record" from examples/tunelog/src/server.ts
// and the SDK it imports. Never edit it by hand.
(function() {
	// src/api/common.ts
	var SongstressError = class extends Error {
		name = "SongstressError";
		code;
		constructor(code, message) {
			super(message);
			this.code = code;
		}
	};
	// src/manifest/rules/permissions.ts
	const HOOK_PERMISSIONS = {
		server: {
			onPlay: "listening.read",
			onScrobble: "listening.read",
			onFavorite: "listening.read",
			onPlaylistChange: "library.read",
			onLibraryChange: "library.read",
			onScanComplete: "library.read"
		},
		client: {
			onPlay: "listening.read",
			onPause: "listening.read",
			onTrackChange: "listening.read",
			onSeek: "listening.read",
			onVolumeChange: null,
			onQueueChange: "listening.read",
			onProgress: "listening.read"
		}
	};
	address(10, 0, 0, 0), address(172, 16, 0, 0), address(192, 168, 0, 0), address(127, 0, 0, 0);
	function address(a, b, c, d) {
		return (a << 24 | b << 16 | c << 8 | d) >>> 0;
	}
	// src/host.ts
	const HOST_KEY = Symbol.for("songstress.host");
	function bridge() {
		const found = globalThis[HOST_KEY];
		if (found) return found;
		throw new SongstressError("no-host", `songstress: no host. The extension API works only inside Songstress, or in a test that put a mock host in place.`);
	}
	const REGISTER = { register: null };
	const PROVIDER = { register: "providers" };
	const SHARED = {
		hooks: { onPlay: HOOK_PERMISSIONS.server.onPlay },
		commands: { register: null },
		ui: {
			pages: REGISTER,
			panels: REGISTER,
			status: REGISTER
		},
		settings: {
			get: null,
			onChange: null
		},
		storage: {
			get: "storage",
			set: "storage",
			delete: "storage",
			keys: "storage"
		},
		net: { fetch: "network" },
		host: { info: null }
	};
	const UI_TOLD = {
		...SHARED.ui,
		notify: null,
		refresh: null
	};
	const SERVER = {
		...SHARED,
		hooks: HOOK_PERMISSIONS.server,
		ui: UI_TOLD,
		secrets: {
			get: "secrets",
			set: "secrets",
			delete: "secrets"
		},
		providers: {
			search: PROVIDER,
			lookup: PROVIDER,
			links: PROVIDER,
			lyrics: PROVIDER,
			metadata: PROVIDER,
			artwork: PROVIDER,
			artistInfo: PROVIDER,
			scrobble: PROVIDER,
			recommend: PROVIDER,
			play: PROVIDER,
			download: PROVIDER
		},
		jobs: {
			register: "jobs",
			start: "jobs"
		},
		routes: { register: "routes" },
		signIn: { register: "secrets" },
		library: {
			getSong: "library.read",
			getAlbum: "library.read",
			getArtist: "library.read",
			getPlaylist: "library.read",
			getAlbumSongs: "library.read",
			getPlaylistSongs: "library.read",
			search: "library.read"
		},
		users: {
			get: "users.read",
			list: "users.read"
		}
	};
	const CLIENT = {
		...SHARED,
		hooks: HOOK_PERMISSIONS.client,
		commands: {
			register: null,
			execute: null
		},
		ui: UI_TOLD,
		player: {
			getState: "listening.read",
			play: "player.control",
			pause: "player.control",
			next: "player.control",
			previous: "player.control",
			seek: "player.control"
		},
		queue: {
			get: "listening.read",
			add: "player.control"
		}
	};
	const isTable = (entry) => typeof entry === "object" && entry !== null;
	function build(table, path = []) {
		const members = Object.entries(table).map(([name, entry]) => {
			const member = [...path, name];
			const call = (...args) => bridge().call(member.join("."), args);
			return [name, isTable(entry) ? build(entry, member) : call];
		});
		return Object.freeze(Object.fromEntries(members));
	}
	function flatten(table, path = []) {
		return Object.entries(table).flatMap(([name, entry]) => isTable(entry) ? flatten(entry, [...path, name]) : [[[...path, name].join("."), entry]]);
	}
	const permissions = (table) => Object.freeze(Object.fromEntries(flatten(table)));
	build(SHARED);
	const serverApi = build(SERVER);
	build(CLIENT);
	Object.freeze({
		shared: permissions(SHARED),
		server: permissions(SERVER),
		client: permissions(CLIENT)
	});
	// examples/tunelog/src/server.ts
	const tunelog = {
		nowPlaying: (request) => serverApi.net.fetch("https://api.tunelog.example/v1/now-playing", request),
		listens: (request) => serverApi.net.fetch("https://api.tunelog.example/v1/listens", request),
		profile: (request) => serverApi.net.fetch("https://api.tunelog.example/v1/me", request)
	};
	function signed(token, body) {
		return {
			method: body ? "POST" : "GET",
			headers: {
				authorization: `Bearer ${token}`,
				"content-type": "application/json"
			},
			body: body ? JSON.stringify(body) : void 0
		};
	}
	const named = (song) => ({
		title: song.title,
		artist: song.artist,
		album: song.album
	});
	serverApi.hooks.onPlay(async (song, play) => {
		const member = { userId: play.userId };
		const token = await serverApi.settings.get("token", member);
		const wanted = await serverApi.settings.get("nowPlaying", member);
		if (token && wanted !== false) await tunelog.nowPlaying(signed(token, named(song)));
	});
	serverApi.hooks.onScrobble(async (song, play) => {
		const member = { userId: play.userId };
		const token = await serverApi.settings.get("token", member);
		if (!token) return;
		const listens = [...await serverApi.storage.get("waiting", member) ?? [], {
			...named(song),
			playedAt: play.playedAt
		}];
		const answer = await tunelog.listens(signed(token, { listens })).catch(() => null);
		const sent = answer !== null && answer.status < 300;
		await serverApi.storage.set("waiting", sent ? [] : listens.slice(-500), member);
	});
	serverApi.commands.register("test-connection", async (_input, context) => {
		const token = await serverApi.settings.get("token", { userId: context.userId });
		const connected = (token ? await tunelog.profile(signed(token)).catch(() => null) : null)?.status === 200;
		return { action: {
			type: "toast",
			message: connected ? "Tunelog is connected." : "Tunelog did not accept the token.",
			tone: connected ? "success" : "danger"
		} };
	});
})();
