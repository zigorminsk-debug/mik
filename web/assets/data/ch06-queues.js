/* Глава 7. Очереди и управление скоростью */
(function () {
  const D = window.MIK_DATA;

  D.chapters.push({
    id: 'ch07', num: 7, icon: '⚡', title: 'Очереди',
    summary: 'Simple queues, PCQ и HTB: как поделить канал честно и не убить скорость.',
    lessons: ['l13']
  });

  D.lessons['l13'] = {
    title: 'Очереди: Simple Queues, PCQ и HTB',
    lead: 'Шейпинг без боли: ограничение скорости, честная делёжка канала, приоритеты и очереди для разных типов трафика.',
    level: 4, time: '15 мин', tags: ['queue', 'pcq', 'htb', 'qos'],
    video: 'assets/media/video/l13.mp4',
    videoCap: 'Видео: очереди и шейпинг на MikroTik',
    transcript: [
      'Очереди в RouterOS отвечают за две разные задачи. Первая — ограничение скорости: клиент не должен скачивать больше, чем ему положено. Вторая — справедливое разделение канала: когда канал занят, каждый получает свою долю, а кто-то один не забирает всё.',
      'Simple queues — самый простой инструмент. Вы задаёте целевой адрес, максимальную скорость и минимальную гарантию. Всё. Для домашней сети, где пара устройств делят канал, этого обычно достаточно.',
      'Важная деталь: simple queues срабатывают в два прохода. Сначала для каждого пакета выбирается одна очередь с наибольшей гарантией. Затем в выбранной очереди ищется самая узкая полоса, и именно её применяют. Поэтому несколько правил с одинаковой гарантией не будут конфликтовать.',
      'PCQ, то есть Per Connection Queue, решает другую задачу. Он распределяет канал между подключениями: у каждого соединения своя очередь, и скорость делится поровну. Это то, что нужно, когда через один канал идут десятки устройств.',
      'Схема выглядит так: на интерфейсе висит одна очередь с target-upload и target-download, а к ней привязана PCQ-очередь с rate и limit. Это ключевой приём — один PCQ на все потоки даёт честную делёжку, в отличие от per-user очередей, где один пользователь с десятью потоками забирает больше.',
      'HTB — иерархическая шейпинг-дерево. Верхний узел задаёт общий лимит канала, дочерние — квоты по группам, а листья — лимиты для отдельных пользователей. Схема сложнее, но даёт точный контроль: например, 70 процентов канала под видео, 20 под рабочие задачи, 10 под резерв.',
      'И последнее: marking. Очереди работают по меткам, поэтому сначала нужно промаркировать трафик в mangle, а потом повесить очередь на метку. Порядок: сначала маркировка, потом очередь.'
    ],
    blocks: [
      { t: 'h', x: 'Три механизма' },
      { t: 'table', head: ['Механизм', 'Что решает', 'Когда применять'], rows: [
        ['Simple queues', 'Лимит скорости и гарантия для одного адреса', 'Дом, офис, простые политики'],
        ['PCQ', 'Честная делёжка канала между соединениями', 'Много устройств через один канал'],
        ['HTB (queue tree)', 'Иерархия квот: канал → группа → пользователь', 'Сложные политики, ISP-like схемы']
      ] },
      { t: 'code', ttl: 'RouterOS CLI — simple queues', x: '# ограничить скорость одного клиента\n/queue simple add name=client-pc target=192.168.88.10/32 max-limit=50M/50M\n\n# несколько адресов через target-list\n/queue simple add name=guest target=192.168.90.0/24 max-limit=10M/10M priority=4/4\n\n# посмотреть статистику в реальном времени\n/queue simple print stats\n/queue simple monitor client-pc' },
      { t: 'note', k: 'info', ttl: 'Два прохода simple queues', x: 'Сначала выбирается очередь с наибольшей гарантией (priority), затем внутри неё применяется самая узкая полоса. Поэтому правила не конфликтуют между собой, но и не складываются: две очереди по 50M не дадут 100M одному клиенту.' },

      { t: 'h', x: 'PCQ: честная делёжка' },
      { t: 'code', ttl: 'RouterOS CLI — PCQ на интерфейсе', x: '/queue pcq add name=pcq-down rate=50M limit=50M total-limit=100M\n/queue pcq add name=pcq-up rate=10M limit=10M\n\n/queue type add name=pcq-down type=pcq pcq-classifier=dst-address pcq-rate=50M pcq-limit=50M pcq-total-limit=100M\n/queue type add name=pcq-up type=pcq pcq-classifier=src-address pcq-rate=10M pcq-limit=10M\n\n# одна очередь на весь интерфейс\n/queue simple add name=interface-queue target=ether1 max-limit=100M/100M queue=pcq-down/pcq-up', note: 'Один PCQ на интерфейс даёт равную долю каждому соединению. Отдельная очередь на каждого клиента даёт неравную долю.' },

      { t: 'h', x: 'HTB: дерево квот' },
      { t: 'code', ttl: 'RouterOS CLI — queue tree', x: '/queue tree add name=wan-down parent=ether1 max-limit=100M\n/queue tree add name=wan-up parent=ether1 max-limit=20M\n\n/queue tree add name=group-video parent=wan-down limit=70M\n/queue tree add name=group-work parent=wan-down limit=25M\n\n/queue tree add name=user-1 parent=group-work limit=10M\n/queue tree add name=user-2 parent=group-work limit=10M\n\n/queue tree print', note: 'Сумма лимитов детей может превышать лимит родителя — тогда реальная скорость всё равно ограничена родителем.' },

      { t: 'h', x: 'Маркировка для очередей' },
      { t: 'code', ttl: 'RouterOS CLI — mangle + queue', x: '/ip firewall mangle add chain=prerouting src-address=192.168.90.0/24 action=mark-packet new-packet-mark=guest-pkt\n/ip firewall mangle add chain=prerouting dst-port=5060 action=mark-packet new-packet-mark=voip-pkt\n\n/queue simple add name=voip target=0.0.0.0/0 packet-mark=voip-pkt priority=1/1 limit=5M/5M\n/queue simple add name=guest target=0.0.0.0/0 packet-mark=guest-pkt priority=4/4 limit=10M/10M', note: 'Приоритет 1 — выше. Если трафик не помечается, он попадёт в очередь по умолчанию интерфейса.' }
    ],
    steps: [
      { title: 'Измерьте реальную скорость', text: 'Узнайте, сколько канал даёт на самом деле, а не сколько написано в договоре.', cmd: '/tool bandwidth-test', note: 'Тестируйте в сторону провайдера и в вашу сторону: аплоад обычно меньше.' },
      { title: 'Создайте очередь на интерфейсе', text: 'Это потолок для всего трафика на интерфейсе.', cmd: '/queue simple add name=wan-limit target=ether1 max-limit=100M/100M', note: 'Ограничивайте чуть ниже реальной скорости: 90-95% от измеренной.' },
      { title: 'Добавьте PCQ для честной делёжки', text: 'Одна очередь PCQ на весь интерфейс.', cmd: '/queue type add name=pcq-down type=pcq pcq-classifier=dst-address pcq-rate=50M pcq-limit=50M\n/queue simple add name=wan-limit target=ether1 max-limit=100M/100M queue=pcq-down/pcq-down', note: 'Без PCQ один активный пользователь заберёт весь канал.' },
      { title: 'Ограничьте отдельных клиентов', text: 'Simple queue на адрес с гарантией и максимумом.', cmd: '/queue simple add name=child-pc target=192.168.88.10/32 max-limit=20M/20M priority=1/1', note: 'Гарантия priority 1/1 даёт этой очереди приоритет при нехватке канала.' },
      { title: 'Промаркируйте приоритетный трафик', text: 'VoIP и видео должны идти первыми.', cmd: '/ip firewall mangle add chain=prerouting dst-port=5060 action=mark-packet new-packet-mark=voip\n/queue simple add name=voip target=0.0.0.0/0 packet-mark=voip priority=1/1 limit=5M/5M', note: 'Маркировка обязательна: без неё приоритетные очереди останутся пустыми.' },
      { title: 'Проверьте результат', text: 'Смотрите реальные скорости и очереди.', cmd: '/queue simple print stats\n/queue simple monitor voip', note: 'Если в очереди «всегда 0 байт» — трафик не маркируется или приоритет настроен неверно.' }
    ],
    pitfalls: [
      { t: 'Скорость не ограничивается', d: 'Проверьте, что правило стоит в simple queues, а не в queue tree, и что его target совпадает с адресом клиента.' },
      { t: 'Один клиент забирает весь канал', d: 'Нет PCQ. Добавьте PCQ-очередь на интерфейс с классификатором по адресу назначения.' },
      { t: 'Приоритетная очередь пустая', d: 'Трафик не промаркирован. Проверьте mangle-правила и то, что они стоят выше других правил с accept.' },
      { t: 'Скорость упала вдвое', d: 'Очередь на интерфейсе с лимитом ниже реальной скорости дублирует ограничение провайдера. Сверьте с bandwidth-test.' },
      { t: 'PCQ не работает на PPPoE', d: 'На PPP-интерфейсах PCQ нужно вешать на queue интерфейса через /interface queue, а не только на simple queue.' }
    ],
    checklist: [
      'Я измерил реальную скорость канала',
      'Я понимаю разницу между simple queues, PCQ и HTB',
      'Я умею создавать PCQ-тип и вешать его на интерфейс',
      'Я знаю, что simple queues работают в два прохода',
      'Я маркирую трафик в mangle для приоритетных очередей',
      'Я умею смотреть статистику через print stats и monitor'
    ],
    quiz: [
      { q: 'Что решает PCQ?', o: ['Шифрование', 'Честное деление канала между соединениями', 'Блокировку сайтов', 'Маршрутизацию'], a: 1, why: 'PCQ выделяет каждому соединению равную долю, не позволяя одному забрать всё.' },
      { q: 'Как ограничить скорость конкретного клиента?', o: ['/ip address add', '/queue simple add target=... max-limit=...', '/ip firewall mangle', '/queue pcq add'], a: 1, why: 'Simple queue с target клиента и max-limit ограничивает его скорость.' },
      { q: 'Зачем нужен mangle при работе с очередями?', o: ['Чтобы шифровать', 'Чтобы маркировать трафик метками, по которым выбирается очередь', 'Чтобы блокировать', 'Чтобы считать трафик'], a: 1, why: 'Очередь на интерфейсе без метки не будет знать, кому принадлежит пакет.' },
      { q: 'Что делает priority=1/1 по сравнению с priority=4/4?', o: ['Ничего', 'Приоритет выше: при нехватке канала этой очереди достанется полоса первой', 'Отключает лимит', 'Удваивает скорость'], a: 1, why: 'Чем меньше число, тем выше приоритет в simple queues.' },
      { q: 'Зачем ограничивать скорость интерфейса, если провайдер уже ограничивает?', o: ['Незачем', 'Чтобы локальный шейпинг не выходил за реальную ёмкость канала и не создавал джиттер', 'Чтобы включить FastPath', 'Чтобы работал DHCP'], a: 1, why: 'Локальный лимит, равный или превышающий реальную скорость, добавляет буферизацию и задержки.' }
    ],
    cheat: [
      { g: 'Очереди', c: '/queue simple add name=guest target=192.168.90.0/24 max-limit=10M/10M', d: 'Ограничить скорость группы' },
      { g: 'Очереди', c: '/queue type add name=pcq-down type=pcq pcq-rate=50M pcq-limit=50M', d: 'Создать тип PCQ' },
      { g: 'Очереди', c: '/queue simple add name=wan target=ether1 max-limit=100M/100M queue=pcq-down/pcq-down', d: 'Очередь на интерфейс с PCQ' },
      { g: 'Очереди', c: '/queue tree add name=group parent=wan-down limit=70M', d: 'Узел дерева HTB' },
      { g: 'Очереди', c: '/queue simple print stats', d: 'Статистика очередей' },
      { g: 'Очереди', c: '/queue simple monitor name', d: 'Живой мониторинг очереди' }
    ],
    summary: 'Simple queues — лимиты и гарантии для адресов, PCQ — честная делёжка между соединениями, HTB — дерево квот. Маркируйте приоритетный трафик в mangle и не ограничивайте выше реальной скорости канала.'
  };
})();
