const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const MIN_SEARCH_INTERVAL_MS = 1100;

const state = {
  start: null,
  end: null,
  lastSearchAt: 0,
  searchSequence: { start: 0, end: 0 },
};
let searchQueue = Promise.resolve();

const form = document.querySelector("#distance-form");
const message = document.querySelector("#form-message");
const submitButton = form.querySelector(".submit-button");
const resultSection = document.querySelector("#distance-result");

function showMessage(text) {
  message.textContent = text;
}

function setLoading(loading) {
  submitButton.disabled = loading;
  submitButton.querySelector(".button-label").textContent = loading ? "경로를 찾고 있어요…" : "거리 계산하기";
}

function setSearchLoading(field, loading) {
  const button = document.querySelector(`[data-search="${field}"]`);
  button.disabled = loading;
  button.setAttribute("aria-label", loading ? "장소 검색 중" : `${field === "start" ? "출발지" : "도착지"} 검색`);
}

function clearResults(field) {
  document.querySelector(`[data-results="${field}"]`).replaceChildren();
}

function describePlace(place) {
  const address = place.address || {};
  const parts = [
    address.city || address.town || address.village || address.county || address.state,
    address.suburb || address.city_district || address.neighbourhood,
    address.road,
  ].filter(Boolean);
  return parts.length ? [...new Set(parts)].join(" · ") : place.display_name;
}

function selectPlace(field, place) {
  state[field] = {
    name: place.name || place.display_name.split(",")[0],
    displayName: place.display_name,
    lat: Number(place.lat),
    lon: Number(place.lon),
  };
  document.querySelector(`#${field}-input`).value = state[field].name;
  document.querySelector(`[data-selection="${field}"]`).textContent = `선택됨 · ${describePlace(place)}`;
  document.querySelector(`[data-field="${field}"]`).classList.add("has-selection");
  clearResults(field);
  resultSection.hidden = true;
  showMessage("");
}

function renderPlaces(field, places) {
  const container = document.querySelector(`[data-results="${field}"]`);
  container.replaceChildren();

  if (!places.length) {
    showMessage(`${field === "start" ? "출발지" : "도착지"} 검색 결과가 없어요. 다른 이름으로 검색해 주세요.`);
    return;
  }

  places.forEach((place) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "place-option";
    const title = document.createElement("strong");
    title.textContent = place.name || place.display_name.split(",")[0];
    const detail = document.createElement("span");
    detail.textContent = describePlace(place);
    option.append(title, detail);
    option.addEventListener("click", () => selectPlace(field, place));
    container.append(option);
  });
  showMessage("검색 결과에서 정확한 장소를 선택해 주세요.");
}

async function waitForSearchSlot() {
  const slot = searchQueue.then(async () => {
    const wait = MIN_SEARCH_INTERVAL_MS - (Date.now() - state.lastSearchAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    state.lastSearchAt = Date.now();
  });
  searchQueue = slot.catch(() => {});
  await slot;
}

async function searchPlace(field) {
  const input = document.querySelector(`#${field}-input`);
  const query = input.value.trim();
  if (!query) {
    showMessage(`${field === "start" ? "출발지" : "도착지"}를 입력해 주세요.`);
    input.focus();
    return;
  }

  const sequence = ++state.searchSequence[field];
  clearResults(field);
  showMessage("실제 장소를 검색하고 있어요…");
  setSearchLoading(field, true);

  try {
    await waitForSearchSlot();
    const url = new URL(NOMINATIM_URL);
    url.search = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      "accept-language": "ko",
    }).toString();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`장소 검색에 실패했어요 (HTTP ${response.status}). 잠시 후 다시 시도해 주세요.`);
    const places = await response.json();
    if (sequence !== state.searchSequence[field]) return;
    renderPlaces(field, places);
  } catch (error) {
    if (sequence === state.searchSequence[field]) showMessage(error.message || "장소 검색 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
  } finally {
    if (sequence === state.searchSequence[field]) setSearchLoading(field, false);
  }
}

function formatDistance(meters) {
  return new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(meters / 1000);
}

async function calculateRoute(event) {
  event.preventDefault();
  if (!state.start || !state.end) {
    showMessage("출발지와 도착지를 각각 검색한 뒤 결과에서 선택해 주세요.");
    return;
  }

  setLoading(true);
  showMessage("");
  resultSection.hidden = true;

  try {
    const coordinates = `${state.start.lon},${state.start.lat};${state.end.lon},${state.end.lat}`;
    const response = await fetch(`${OSRM_URL}/${coordinates}?overview=false&steps=false`);
    if (!response.ok) throw new Error(`경로 조회에 실패했어요 (HTTP ${response.status}). 잠시 후 다시 시도해 주세요.`);
    const data = await response.json();
    if (data.code !== "Ok" || !data.routes || !data.routes.length) {
      throw new Error("두 장소 사이의 자동차 경로를 찾지 못했어요. 검색 결과에서 다른 장소를 선택해 주세요.");
    }

    document.querySelector("#distance-value").textContent = formatDistance(data.routes[0].distance);
    document.querySelector("#route-summary").textContent = `${state.start.name}에서 ${state.end.name}까지 · 자동차 경로`;
    const mapUrl = new URL("https://www.openstreetmap.org/directions");
    mapUrl.searchParams.set("engine", "fossgis_osrm_car");
    mapUrl.searchParams.set("route", `${state.start.lat},${state.start.lon};${state.end.lat},${state.end.lon}`);
    document.querySelector("#map-link").href = mapUrl.toString();
    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    showMessage(error.message || "경로 조회 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
  } finally {
    setLoading(false);
  }
}

for (const field of ["start", "end"]) {
  document.querySelector(`[data-search="${field}"]`).addEventListener("click", () => searchPlace(field));
  document.querySelector(`#${field}-input`).addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchPlace(field);
    }
  });
  document.querySelector(`#${field}-input`).addEventListener("input", () => {
    state[field] = null;
    state.searchSequence[field] += 1;
    setSearchLoading(field, false);
    document.querySelector(`[data-selection="${field}"]`).textContent = "";
    document.querySelector(`[data-field="${field}"]`).classList.remove("has-selection");
    clearResults(field);
    resultSection.hidden = true;
    showMessage("");
  });
}

form.addEventListener("submit", calculateRoute);
