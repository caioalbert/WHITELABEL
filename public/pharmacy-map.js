/* The map receives only public pharmacy addresses. Customer identity/tokens never reach Google. */
(() => {
  const root = document.getElementById('pharmacy-map');
  const status = document.getElementById('map-status');
  const config = JSON.parse(decodeURIComponent(root.dataset.config));
  function notice(text) { status.textContent = text; }
  window.gm_authFailure = () => notice('Mapa indisponível no momento. Consulte a lista ou tente novamente.');
  window.initPharmacyMap = async () => {
    try {
      const { Map, InfoWindow } = await google.maps.importLibrary('maps');
      const { LatLngBounds } = await google.maps.importLibrary('core');
      const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
      const map = new Map(root, { center: { lat: -14.235, lng: -51.9253 }, zoom: 4, mapId: config.mapId, streetViewControl: false, mapTypeControl: false, fullscreenControl: true });
      const geocoder = new google.maps.Geocoder();
      const bounds = new LatLngBounds();
      const popup = new InfoWindow();
      let located = 0;
      const progress = () => notice(`${located} de ${config.stores.length} lojas no mapa`);
      for (const store of config.stores) {
        let position = typeof store.latitude === 'number' && typeof store.longitude === 'number' ? { lat: store.latitude, lng: store.longitude } : null;
        if (!position) {
          try {
            const response = await geocoder.geocode({ address: [store.endereco, store.bairro, store.cidade, store.uf, store.cep, 'Brasil'].filter(Boolean).join(', '), componentRestrictions: { country: 'BR' } });
            const result = response.results.find(r => !r.partial_match && ['ROOFTOP', 'RANGE_INTERPOLATED'].includes(r.geometry.location_type) && r.address_components.some(c => c.types.includes('administrative_area_level_1') && c.short_name === store.uf));
            if (result) position = result.geometry.location;
          } catch (error) {
            if (['OVER_QUERY_LIMIT', 'REQUEST_DENIED'].includes(error.code)) { notice('Não foi possível localizar todas as lojas agora. Consulte a lista e tente novamente mais tarde.'); break; }
          }
          // Geocoding is sequential, only on map opening. Results stay in this view's memory.
          await new Promise(resolve => setTimeout(resolve, 350));
        }
        if (!position) { progress(); continue; }
        const badge = document.createElement('div');
        badge.className = 'pharmacy-marker';
        const logo = document.createElement('img');
        logo.src = '/pague-menos-logo.svg';
        logo.alt = 'Pague Menos';
        logo.width = 78; logo.height = 30;
        logo.draggable = false;
        badge.append(logo);
        const marker = new AdvancedMarkerElement({ map, position, title: `${store.nome} · Farmácia Popular`, content: badge });
        marker.addListener('click', () => {
          const card = document.createElement('div');
          const title = document.createElement('h2'); title.textContent = store.nome; card.append(title);
          const address = document.createElement('p'); address.textContent = [store.endereco, store.bairro, `${store.cidade}/${store.uf}`, store.cep].filter(Boolean).join(' · '); card.append(address);
          const route = document.createElement('a'); route.textContent = 'Como chegar'; route.target = '_blank'; route.rel = 'noopener noreferrer';
          route.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([store.endereco, store.cidade, store.uf, store.cep].join(', '))}`;
          card.append(route); popup.setContent(card); popup.open({ map, anchor: marker });
        });
        bounds.extend(position); located++; if (located <= 3 || located === config.stores.length) { map.fitBounds(bounds, 40); if (located === 1) map.setZoom(15); } progress();
      }
      if (!config.stores.length) notice('Nenhuma loja encontrada para estes filtros.');
      else if (!located) notice('Não foi possível localizar estes endereços com precisão. Consulte a lista de lojas.');
      else map.fitBounds(bounds, 40);
    } catch { notice('Mapa indisponível no momento. Consulte a lista ou tente novamente.'); }
  };
  if (!config.browserKey || !config.mapId) return notice('Mapa indisponível no momento. Consulte a lista ou tente novamente.');
  notice('Localizando endereços das lojas…');
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.browserKey)}&loading=async&callback=initPharmacyMap&v=weekly&language=pt-BR&region=BR`;
  script.async = true; script.onerror = () => notice('Não foi possível carregar o mapa. Verifique sua conexão e tente novamente.');
  document.head.append(script);
})();
