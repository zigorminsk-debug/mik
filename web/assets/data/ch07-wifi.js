/* Глава 8. Беспроводная сеть */
(function () {
  const D = window.MIK_DATA;

  D.chapters.push({
    id: 'ch08', num: 8, icon: '📶', title: 'Wi-Fi',
    summary: 'Точки доступа, CAPsMAN, гостевые сети, мощность и покрытие.',
    lessons: ['l14']
  });

  D.lessons['l14'] = {
    title: 'Wi-Fi: точки доступа, CAPsMAN и гостевые сети',
    lead: 'Строим беспроводную сеть правильно: один SSID на всём офисе, отдельная гостевая сеть с изоляцией и нормальной мощностью.',
    level: 4, time: '16 мин', tags: ['wifi', 'capsman', 'ssid'],
    video: 'assets/media/video/l14.mp4',
    videoCap: 'Видео с субтитрами: настройка Wi-Fi и CAPsMAN',
    transcript: [
      'Беспроводная сеть — это две разные задачи. Первая: роутер сам раздаёт Wi-Fi. Вторая: несколько точек доступа работают как одна система, и управляются с одного устройства. Второе называется CAPsMAN.',
      'Начнём с простого. Режим AP включается одной командой: wireless interface set wlan1 mode=ap ssid=MyWiFi. Дальше нужно задать ключ шифрования и полосу. В RouterOS 7 вторая полоса 5 ГГц лежит на отдельном интерфейсе, обычно wlan2.',
      'Выбор полосы определяет всё. 2.4 ГГц дальше пробивает стены, но быстрее забивается помехами: там всего три непересекающихся канала. 5 ГГц чище и быстрее, но гаснет за стеной. В помещении офиса оптимально держать обе полосы с одинаковым SSID, а устройства выберут лучшую сами.',
      'Теперь CAPsMAN. Это менеджер точек доступа: одно устройство создаёт сеть, а точки доступа подключаются к нему и получают настройки автоматически. Сначала создаётся менеджер с certificate, потом на точке настраивается manager, потом описываются профили и конфигурации.',
      'Профили определяют параметры: имя, шифрование, полосы. Конфигурации определяют, к какому профилю и в каком режиме работает точка. Это разделение удобно: можно иметь два профиля, например, для сотрудников и для гостей, и применять их к разным точкам.',
      'Гостевая сеть делается через отдельный профиль с включённым client isolation. Это значит, что устройства гостей не видят друг друга и не могут достать принтеры или сетевые диски в основной сети. И обязательно отдельный VLAN для гостей, чтобы правила firewall работали корректно.',
      'И последнее — мощность. Не нужно выкручивать мощность на максимум: чужой сигнал в эфире вам мешает так же, как ваш — соседям. Правило простое: мощность должна быть минимально достаточной для покрытия нужной площади. Для квартиры обычно хватает минимальной мощности, для офиса — средней.'
    ],
    blocks: [
      { t: 'h', x: 'Режимы беспроводного интерфейса' },
      { t: 'table', head: ['Режим', 'Что делает'], rows: [
        ['ap', 'Точка доступа: раздаёт Wi-Fi клиентам'],
        ['station', 'Клиент: подключается к другой точке (мост)'],
        ['bridge', 'Беспроводный мост между сегментами'],
        ['wds', 'Беспроводный мост с четырьмя адресами (WDS)'],
        ['mesh', 'Mesh-сеть, динамическая топология (RouterOS 7)']
      ] },
      { t: 'code', ttl: 'RouterOS CLI — точка доступа', x: '/interface wireless set wlan1 mode=ap ssid="Mik-Office" band=2ghz-b/g/n \\\n    country="russia" wireless-protocol=802.11 security-profile=profile1\n\n/interface wireless security-profiles add name=profile1 mode=dynamic-psk \\\n    authentication-types=wpa2-psk,wpa3-psk encryption=AES \\\n    passphrase="VeryStrongKey2026!"\n\n/interface wireless set wlan2 mode=ap ssid="Mik-Office" band=5ghz-a/n/ac \\\n    wireless-protocol=802.11 security-profile=profile1\n\n/interface wireless print\n/interface wireless monitor wlan1 once', note: 'Страна влияет на разрешённые каналы и мощность. Неверная страна — одна из причин «сеть не видна на телефоне».' },

      { t: 'h', x: 'CAPsMAN: одна сеть, много точек' },
      { t: 'code', ttl: 'RouterOS CLI — менеджер и точки', x: '# 1. менеджер на центральном устройстве\n/certificate add name=capman-cert common-name=capman days-valid=3650\n/certificate sign capman-cert\n/interface wireless capsm manager set enabled=yes certificate=capman-cert ca-certificate=auto \\\n    require-peer-certificate=yes authentication-method=rsa512 sha256\n\n# 2. точка доступа подключается к менеджеру\n/interface wireless capsm set [find interface=wlan1] enabled=yes master-configuration=capman1 \\\n    slave=yes\n\n# 3. профиль и конфигурация\n/interface wireless capsm profile add name=profile-office ssid="Mik-Office" \\\n    security-profile=profile1 add-mac-address=00:00:00:00:00:00\n\n/interface wireless capsm configuration add name=cfg-office master-configuration=capman1 \\\n    profile=profile-office channel=auto datapath=802.11\n\n# 4. привязка конфигурации к точке\n/interface wireless capsm configuration set [find name~"cfg-office"] \n    ssid="Mik-Office" channel=auto', note: 'В RouterOS 7 структура профилей и конфигураций изменилась: config-set и datapath. Сверяйтесь с версией устройства.' },
      { t: 'note', k: 'info', ttl: 'Как это работает', x: 'Центральный узел (manager) раздаёт сертификаты и конфигурации, точки (slave) их применяют. Всё управление идёт через manager: сменили SSID в конфигурации — все точки обновились.' },

      { t: 'h', x: 'Гостевая сеть с изоляцией' },
      { t: 'code', ttl: 'RouterOS CLI — гости', x: '# отдельный VLAN для гостей\n/interface vlan add name=vlan-guest interface=bridge1 vlan-id=90\n/ip address add address=192.168.90.1/24 interface=vlan-guest\n/ip pool add name=pool-guest ranges=192.168.90.100-192.168.90.200\n/ip dhcp-server add name=dhcp-guest interface=vlan-guest address-pool=pool-guest\n/ip dhcp-server network add address=192.168.90.0/24 gateway=192.168.90.1 dns-server=192.168.90.1\n\n# профиль гостевой сети с изоляцией клиентов\n/interface wireless capsm profile add name=profile-guest ssid="Guest" \\\n    security-profile=profile-guest isolation=none\n\n# firewall: гости только в интернет\n/ip firewall filter add chain=forward src-address=192.168.90.0/24 out-interface=ether1 action=accept\n/ip firewall filter add chain=forward src-address=192.168.90.0/24 action=drop', note: 'Изоляция клиентов (client isolation) настраивается в wireless-профиле: client-isolation=yes или isolation=separate в CAPsMAN.' },

      { t: 'h', x: 'Мощность и покрытие' },
      { t: 'ul', x: [
        '**Минимум** — для одной комнаты, квартиры.',
        '**Средний** — офис до 100 м², несколько точек с перекрытием.',
        '**Максимум** — только для линий связи между зданиями.',
        '**Правило 20 процентов** — целься в сигнал -65 дБм в рабочей зоне, выше 20 процентов мощности на точку обычно не нужно.'
      ] },
      { t: 'code', ttl: 'RouterOS CLI — мощность', x: '/interface wireless set wlan1 tx-power=17\n/interface wireless set wlan2 tx-power=17\n\n# диагностика\n/interface wireless monitor wlan1 once', note: 'Значение tx-power в dBm: 10-20 — средний, 30 — максимум для большинства устройств.' }
    ],
    steps: [
      { title: 'Проверьте радиомодули', text: 'Убедитесь, какие интерфейсы беспроводные и на каких частотах.', cmd: '/interface wireless print', note: 'В RouterOS 7 обычно wlan1 = 2.4 ГГц, wlan2 = 5 ГГц.' },
      { title: 'Создайте профиль безопасности', text: 'Один профиль на сеть, с WPA2 и WPA3.', cmd: '/interface wireless security-profiles add name=profile1 mode=dynamic-psk authentication-types=wpa2-psk,wpa3-psk encryption=AES passphrase="VeryStrongKey2026!"', note: 'Ключ от 8 символов. Для гостей удобнее отдельный профиль с captive-подобным доступом или отдельный ключ.' },
      { title: 'Переведите интерфейс в режим AP', text: 'Задайте SSID, полосу и профиль.', cmd: '/interface wireless set wlan1 mode=ap ssid="Mik-Office" band=2ghz-b/g/n security-profile=profile1', note: 'Оставьте 2.4 ГГц в режиме b/g для максимальной совместимости, 5 ГГц — в режиме ac.' },
      { title: 'Настройте CAPsMAN (если точек несколько)', text: 'Менеджер на центральном устройстве, точки в режиме slave.', cmd: '/interface wireless capsm manager set enabled=yes certificate=capman-cert', note: 'Сертификаты обязательны: без них точки не подключатся.' },
      { title: 'Создайте гостевую сеть', text: 'Отдельный VLAN, отдельный DHCP, изоляция клиентов.', cmd: '/ip firewall filter add chain=forward src-address=192.168.90.0/24 out-interface=ether1 action=accept', note: 'Гостевой трафик не должен попадать в корпоративные сегменты.' },
      { title: 'Проверьте покрытие и мощность', text: 'Измерьте сигнал в контрольных точках и уменьшите мощность.', cmd: '/interface wireless monitor wlan1 once', note: 'Ориентир: -65 дБм — отличный сигнал, -75 дБм — минимально рабочий.' }
    ],
    pitfalls: [
      { t: 'Телефон не видит сеть', d: 'Проверьте страну (country), ширину канала (20 МГц для 2.4), поддерживаемый режим и то, что SSID не скрыт.' },
      { t: 'Wi-Fi есть, но без интернета', d: 'Гость в гостевой сети без маршрута или заблокирован firewall-правилом для 192.168.90.0/24.' },
      { t: 'Точки не подключаются к CAPsMAN', d: 'Проверьте сертификаты, серию устройств (CAPsMAN не управляет разными сериями с разными чипами в некоторых версиях) и время на устройствах.' },
      { t: 'Сеть «прыгает» между точками', d: 'Слишком высокая мощность или перекрытие каналов. Уменьшите tx-power и разнесите точки по каналам.' },
      { t: 'Гости видят принтер в основной сети', d: 'Не включена изоляция клиентов и гости в одной подсети с основной сетью.' }
    ],
    checklist: [
      'Я знаю, чем AP отличается от station и bridge',
      'Я создал профиль безопасности с WPA2/WPA3',
      'Я задал правильную страну и полосу',
      'Я понимаю, зачем нужен CAPsMAN и сертификаты',
      'Я вынес гостей в отдельный VLAN с изоляцией',
      'Я умею измерять уровень сигнала и настраивать мощность'
    ],
    quiz: [
      { q: 'Какой параметр определяет максимальную допустимую мощность и каналы?', o: ['ssid', 'country', 'mode', 'band'], a: 1, why: 'country задаёт региональные ограничения по мощности и набору каналов.' },
      { q: 'Что делает client isolation?', o: ['Шифрует трафик', 'Запрещает устройствам одной сети видеть друг друга', 'Отключает DHCP', 'Ускоряет Wi-Fi'], a: 1, why: 'Изоляция клиентов нужна для гостевой и публичной сети.' },
      { q: 'Зачем нужен CAPsMAN?', o: ['Усиливает сигнал', 'Управляет множеством точек доступа из одного центра', 'Шифрует трафик', 'Распределяет IP'], a: 1, why: 'CAPsMAN = Controlled Access Point Management System: единое управление точками и конфигурациями.' },
      { q: 'Почему не стоит выставлять максимальную мощность?', o: ['Роутер перегреется', 'Помехи от соседних сетей и лишнее «зло» в эфире', 'Скорость упадёт', 'Не работает в 5 ГГц'], a: 1, why: 'Сильный сигнал мешает соседям, а вам мешает их сигнал. Достаточно минимально необходимой мощности.' },
      { q: 'Сколько непересекающихся каналов есть в диапазоне 2.4 ГГц?', o: ['3', '5', '13', '11'], a: 0, why: 'В 2.4 ГГц всего три непересекающихся канала: 1, 6 и 11.' }
    ],
    cheat: [
      { g: 'Wi-Fi', c: '/interface wireless print', d: 'Радиоинтерфейсы и их режимы' },
      { g: 'Wi-Fi', c: '/interface wireless set wlan1 mode=ap ssid="MyWiFi"', d: 'Перевести интерфейс в режим точки доступа' },
      { g: 'Wi-Fi', c: '/interface wireless security-profiles add name=profile1 mode=dynamic-psk passphrase="key"', d: 'Профиль безопасности' },
      { g: 'Wi-Fi', c: '/interface wireless monitor wlan1 once', d: 'Уровень сигнала и состояние' },
      { g: 'CAPsMAN', c: '/interface wireless capsm manager set enabled=yes certificate=capman-cert', d: 'Включить менеджер точек' },
      { g: 'CAPsMAN', c: '/interface wireless capsm profile add name=profile-guest ssid="Guest"', d: 'Профиль для гостевой сети' }
    ],
    summary: 'AP — это интерфейс в режиме ap с профилем безопасности. CAPsMAN управляет точками из центра через сертификаты. Гости — отдельный VLAN, отдельный DHCP, изоляция клиентов. Мощность — минимально достаточная, 2.4 ГГц на каналах 1/6/11.'
  };
})();
