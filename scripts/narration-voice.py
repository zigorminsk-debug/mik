#!/usr/bin/env python3
"""Перевод текста урока в «разговорный» вид для синтеза речи.

Русские синтезаторы плохо произносят латиницу, сокращения и числовые
адреса. Здесь каждый технический термин, адрес и число превращается в
обычные слова: «RouterOS» -> «Роутер ОС», «192.168.88.1/24» ->
«сто девяносто два точка сто шестьдесят восемь точка восемьдесят восемь
точка один на двадцати четырёх».

Текст урока не меняется — это только сценарий для озвучки.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --------------------------------------------------------------------------
# Словарь: токен как в тексте -> как его надо прочитать
# --------------------------------------------------------------------------
DICT = {
    # платформы и продукты
    "MikroTik": "Микротик", "RouterOS": "Роутер ОС", "Winbox": "Винбокс",
    "winbox": "винбокс", "Linux": "Линукс", "Neighbors": "Найборс",
    "Wireshark": "Вайршарк", "wireshark": "вайршарк", "Ansible": "Ансибль",
    "Terraform": "Тераформ", "CHR": "си хэр", "ARM": "арм",
    "x86": "икс восемьдесят шесть", "hAP": "хап", "hEX": "хекс",
    "RB": "ар би", "CCR": "си си ар", "CRS": "си ар эс",
    "mikrotik.cfg": "файл конфигурации", "System": "Система",
    "Licenses": "Лицензии", "Linux": "Линукс", "Docker": "Докер",
    "Python": "Пайтон", "VirtualBox": "виртуал бокс", "VMware": "в м варе",
    "MyWiFi": "май вай фай", "YouTube": "ютуб", "help.mikrotik.com":
    "хелп майкротик ком", "mikrotik/routeros": "микротик роутер о с",
    "nas.local": "нас локал", "Powerful": "мощный", "Loopback": "лупбэк",
    "Packages": "пакеты", "Upgrades": "апгрейды", "Files": "файлы",
    "Shell": "Шелл", "Torch": "Торч", "Traceroute": "Трейсероут",
    "Packet": "пакет", "Per": "пэр", "Manager": "менеджер",
    # протоколы и технологии
    "Wi-Fi": "вай фай", "IPv6": "ай пи в шесть", "IPv4": "ай пи в четыре",
    "IPsec": "ай пи сек", "IP": "ай пи", "ip": "ай пи", "DHCP": "ДХСН",
    "DNS": "ДНС", "dns": "днс", "SSH": "Эс Эс Эч", "ssh": "эс эс эч",
    "Telnet": "Телнет", "telnet": "телнет", "FTP": "Эф Ти Пи", "ftp": "эф ти пи",
    "HTTP": "Х Т Т П", "HTTPS": "Х Т Т П Эс", "API": "эй пи ай", "api": "эй пи ай",
    "REST": "рэст", "VLAN": "в лан", "vlan": "в лан", "VPN": "в п н",
    "NAT": "нат", "nat": "нат", "SNMP": "эс эн эм пи", "OSPF": "о эс пи эф",
    "BGP": "би джи пи", "LACP": "ла кп", "MLAG": "эм лаг", "PPP": "пи пи пи",
    "PPPoE": "пи пи пи о е", "L2TP": "эл два ти пи", "L2TP/IPsec":
    "эл два ти пи ай пи сек", "WireGuard": "вайр гард", "GRE": "грэ",
    "EoIP": "и о ай пи", "TCP": "т си пи", "UDP": "ю ди пи", "MAC": "мак",
    "CIDR": "сидр", "STP": "эс ти пи", "PVID": "пи вид", "LAN": "лан",
    "WAN": "ван", "SSID": "эс си и ди", "ssid": "эс си и ди", "LTE": "л т и",
    "ICMP": "и си эм пи", "IKEv2": "ай ки и два", "JSON": "джейсон",
    "NTP": "эн ти пи", "PSK": "пи эс кей", "QoS": "кью о эс", "TTL": "ти ти эл",
    "PKCS12": "п к к с двенадцать", "OVA": "ова", "CCNP": "си си эн пи",
    "DSCP": "ди эс си пи", "DoS": "дос", "EAP": "и эй пи", "HTB": "эйч ти би",
    "Layer7": "лэйер семь", "CAPsMAN": "капсман", "PCQ": "пи си кью",
    # разделы RouterOS и команды
    "interface": "интерфейс", "interfaces": "интерфейсы", "queue": "кью",
    "Queue": "Кью", "queues": "кьюи", "filter": "фильтр", "Firewall": "Файрвол",
    "firewall": "файрвол", "mangle": "мэнгл", "Mangle": "Мэнгл", "raw": "роу",
    "srcnat": "срс нэт", "Srcnat": "Срс нэт", "dstnat": "дст нэт",
    "conntrack": "конн трек", "hairpin": "хейрпин", "bonding": "бондинг",
    "simple": "симпл", "Simple": "Симпл", "established": "эстаблишед",
    "accept": "аксепт", "drop": "дроп", "forward": "форвард",
    "connection": "конекшн", "Connection": "Конекшн", "tracking": "трекинг",
    "distance": "дистанс", "policy": "полиси", "Policy": "Полиси",
    "protocol": "протокол", "port": "端口" if False else "порт",
    "print": "принт", "detail": "дитайл", "set": "сет", "add": "эдд",
    "remove": "ремув", "monitor": "монитор", "check": "чек", "find": "файнд",
    "log": "лог", "area": "эриа", "action": "экшн", "Masquerade": "маскерэйд",
    "routing": "рутинг", "route": "роут", "routes": "роуты",
    "mark-routing": "марк рутинг", "routing-mark": "рутинг марк",
    "mark": "марк", "marking": "маркинг", "master": "мастер",
    "src-address": "срс адресс", "dst-address": "дст адресс",
    "dst-port": "дст порт", "to-address": "ту адресс", "to-addresses": "ту адрес",
    "to-ports": "ту портс", "in-interface": "ин интерфейс",
    "per-user": "пер юзер", "default-route": "дефолт роут",
    "link-state": "линк стейт", "target-download": "таргет даунлоад",
    "target-upload": "таргет аплоад", "use-peer-ntp": "юз пир эн ти пи",
    "use-peer-dns": "юз пир днс", "message-digest": "месседж диджест",
    "site-to-site": "сайт ту сайт", "allow-remote-requests":
    "аллоу ремоут реквестс", "vlan-filtering": "в лан фильтринг",
    "frame-types": "фрейм тайпс",
    "admit-only-untagged-and-priority-tagged":
    "адмит онли антагд энд приорити тагд",
    "balance-alb": "бэленс элб", "Balance-alb": "бэленс элб",
    "active-backup": "эктив бэкап", "Active-backup": "эктив бэкап",
    "bonding-lacp": "бондинг лакп", "802.3ad": "восемьсот два, три ад",
    "802.1ax": "восемьсот два, один акс", "ssh-keygen": "эс эс эч кейген",
    "ssh-keys": "эс эс эч ключи", "ether1": "эзер один", "ether2": "эзер два",
    "ether3": "эзер три", "ether4": "эзер четыре", "ether5": "эзер пять",
    "wlan1": "в лан один", "wlan2": "в лан два", "vlan10": "в лан десять",
    "vlan20": "в лан двадцать", "ax2": "акс два", "ax": "акс",
    "internet": "интернет", "bridge": "бридж", "bridging": "бриджинг",
    "broadcast": "броудкаст", "ethernet": "этернет", "Ethernet": "Этернет",
    "wireless": "вайрлес", "radius": "рэдиус", "netwatch": "нетвоч",
    "Netwatch": "Нетвоч", "sniffer": "сниффер", "pcap": "пкап",
    "git": "гит", "scp": "эс си пи", "serial": "сериал", "USB": "ю эс би",
    "password": "пароль", "email": "и мейл", "guest": "гость", "group": "группа",
    "client": "клиент", "certificate": "сертификат", "table": "таблица",
    "tool": "тул", "put": "пут", "save": "сэйв", "new": "нью", "large": "лардж",
    "any": "эни", "based": "бейсед", "delay": "делай", "down": "даун",
    "flood": "флуд", "foreach": "фор ич", "recusive": "рекурсив",
    "recursive": "рекурсив", "result": "результат", "while": "вайл",
    "zero": "зиро", "yes": "да", "no": "нет", "R": "эр", "ad": "эд",
    "syn": "син", "isolation": "айзолэйшн", "limit": "лимит", "link": "линк",
    "info": "инфо", "input": "инпут", "output": "аутпут", "mode": "моди",
    "per": "пер", "rate": "рейт", "static": "статик", "transport": "транспорт",
    "unreachable": "анриччэбл", "offload": "офлоад", "failover": "фэйловер",
    "management": "менеджмент", "SOHO": "сохо", "Advanced": "эдвансед",
    "Subscriber": "сабскрайбер", "RADIUS": "рэдиус", "L2": "уровня два",
    "L3": "уровня три", "L4": "уровня четыре", "www": "дабл ю дабл ю",
    "AP": "эй пи", "ap": "эй пи", "ARP": "арп", "arp": "арп",
    "RS-232": "ар эс триста тридцать два", "admin": "админ", "user": "юзер",
    "backup": "бэкап", "connected": "коннектед", "disabled": "дизэблед",
    "hop": "хоп", "manager": "менеджер", "ping": "пинг",
}

# Токены, начинающиеся с цифры, — обрабатываются до основного словаря
PRE = {
    "802.3ad": "восемьсот два, три ад", "802.1ax": "восемьсот два, один акс",
}

# --------------------------------------------------------------------------
# Числа словами
# --------------------------------------------------------------------------
ONES = {
    0: "ноль", 1: "один", 2: "два", 3: "три", 4: "четыре", 5: "пять", 6: "шесть",
    7: "семь", 8: "восемь", 9: "девять", 10: "десять", 11: "одиннадцать",
    12: "двенадцать", 13: "тринадцать", 14: "четырнадцать", 15: "пятнадцать",
    16: "шестнадцать", 17: "семнадцать", 18: "восемнадцать", 19: "девятнадцать",
    20: "двадцать", 30: "тридцать", 40: "сорок", 50: "пятьдесят", 60: "шестьдесят",
    70: "семьдесят", 80: "восемьдесят", 90: "девяносто",
}
TEENS = {10: "десять", 11: "одиннадцать", 12: "двенадцать", 13: "тринадцать",
         14: "четырнадцать", 15: "пятнадцать", 16: "шестнадцать",
         17: "семнадцать", 18: "восемнадцать", 19: "девятнадцать"}


def num_words(n):
    """Число до 999999 словами."""
    if n < 0:
        return "минус " + num_words(-n)
    if n < 20:
        return ONES[n]
    if n < 100:
        if n % 10 == 0:
            return ONES[n]
        return ONES[n // 10 * 10] + " " + ONES[n % 10]
    if n < 1000:
        rest = n % 100
        head = ONES[n // 100] + " сто"
        if rest == 0:
            return head
        if rest < 20:
            return head + " " + ONES[rest]
        return head + " " + ONES[rest // 10 * 10] + " " + ONES[rest % 10]
    if n < 1000000:
        rest = n % 1000
        thousands = n // 1000
        if thousands % 10 == 1 and thousands % 100 != 11:
            word = "тысяча"
        elif 2 <= thousands % 10 <= 4 and not (12 <= thousands % 100 <= 14):
            word = "тысячи"
        else:
            word = "тысяч"
        head = num_words(thousands) + " " + word
        if rest == 0:
            return head
        return head + " " + num_words(rest)
    return str(n)


def ip_words(ip):
    """Адрес словами: 192.168.88.1 -> сто девяносто два точка сто шестьдесят..."""
    return " точка ".join(num_words(int(p)) for p in ip.split("."))


def mac_words(mac):
    """MAC-адрес словами."""
    out = []
    for p in mac.split(":"):
        v = int(p, 16)
        out.append(ONES[v] if v < 20 else num_words(v))
    return " ".join(out)


RE_IP = re.compile(r"\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b")
RE_CIDR = re.compile(r"/(\d{1,2})\b")
RE_MAC = re.compile(r"\b([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5})\b")
RE_NUM = re.compile(r"(?<![\w.])(\d{1,6})(?!\w)(?!\.\d)")
RE_DOTNUM = re.compile(r"(?<![\w])\.(\d{1,3})(?!\w)")
RE_TOKEN = re.compile(r"[A-Za-z][A-Za-z0-9]*(?:[.\-_/][A-Za-z0-9]+)*")
RE_TIME = re.compile(r"\b(\d{1,2})m\b")
RE_TIMEH = re.compile(r"\b(\d{1,2})h\b")

# Буквы английского алфавита -> звучание (для неизвестных слов)
LETTERS = {
    "a": "эй", "b": "би", "c": "си", "d": "ди", "e": "и", "f": "эф", "g": "джи",
    "h": "эйч", "i": "ай", "j": "джей", "k": "кей", "l": "эл", "m": "эм",
    "n": "эн", "o": "оу", "p": "пи", "q": "кью", "r": "ар", "s": "эс",
    "t": "ти", "u": "ю", "v": "ви", "w": "дабл ю", "x": "экс", "y": "вай", "z": "зет",
}
DIGRAPHS = [("ch", "ч"), ("sh", "ш"), ("th", "т"), ("ph", "ф"), ("ck", "к"),
             ("oo", "у"), ("ee", "и"), ("ea", "и"), ("ou", "ау"), ("oi", "ой")]


def translit(token):
    """Произносит неизвестное английское слово по-русски."""
    out, i = [], 0
    low = token.lower()
    while i < len(low):
        for dig, rep in DIGRAPHS:
            if low.startswith(dig, i):
                out.append(rep)
                i += len(dig)
                break
        else:
            ch = low[i]
            if ch.isdigit():
                j = i
                while j < len(low) and low[j].isdigit():
                    j += 1
                out.append(num_words(int(low[i:j])))
                i = j
            elif ch in LETTERS:
                out.append(LETTERS[ch])
                i += 1
            else:
                i += 1
    return " ".join(out)


def latin_token(token):
    """Заменяет латинский токен: сначала словарь, иначе — произношение."""
    if token in DICT:
        return DICT[token]
    low = token.lower()
    if low in DICT:
        return DICT[low]
    if "." in token or "/" in token or "-" in token:
        parts = re.split(r"([.\-/])", token)
        out = []
        for p in parts:
            if p == ".":
                out.append("точка")
            elif p == "-":
                out.append("дефис")
            elif p == "/":
                out.append("слэш")
            elif p:
                out.append(DICT.get(p, DICT.get(p.lower(), translit(p))))
        return " ".join(out)
    return translit(token)


def speechify(text):
    """Превращает текст урока в текст для чтения вслух."""
    if not text:
        return ""

    def _ip(m):
        return ip_words(m.group(1))

    def _cidr(m):
        return " на " + num_words(int(m.group(1)))

    def _mac(m):
        return mac_words(m.group(1))

    def _time(m):
        return num_words(int(m.group(1))) + " минут"

    def _timeh(m):
        return num_words(int(m.group(1))) + " часов"

    def _num(m):
        n = int(m.group(1))
        if n > 999999:
            return m.group(1)
        return num_words(n)

    def _dotnum(m):
        return " точка " + num_words(int(m.group(1)))

    # «L2-сегменте» -> «сегменте второго уровня»
    text = re.sub(r"\bL([234])-сегмент(\w*)",
                  lambda m: "сегмент" + ("е" if m.group(2) else "") + " "
                  + {"2": "второго", "3": "третьего", "4": "четвёртого"}[m.group(1)]
                  + " уровня", text)
    # «VLAN-ы» -> «вланы»
    for src, dst in (("VLAN-ы", "вланы"), ("VLAN-ов", "вланов"),
                     ("VLAN-ах", "вланах"), ("VLAN-ам", "вланам")):
        text = text.replace(src, dst)
    # адреса, маски и единицы времени
    text = RE_IP.sub(_ip, text)
    text = RE_MAC.sub(_mac, text)
    text = RE_CIDR.sub(_cidr, text)
    text = RE_TIME.sub(_time, text)
    text = RE_TIMEH.sub(_timeh, text)
    # токены, начинающиеся с цифры
    for src, dst in PRE.items():
        text = text.replace(src, dst)
    # латинские токены
    text = RE_TOKEN.sub(lambda m: latin_token(m.group(0)), text)
    # оставшиеся числа
    text = RE_NUM.sub(_num, text)
    # «.0» и «.255»
    text = RE_DOTNUM.sub(_dotnum, text)
    # дефис между русскими словами -> пробел
    text = re.sub(r"([а-яё]{2,})-([а-яё])", r"\1 \2", text)
    # приводим вид «адрес=значение» к произносимому
    text = re.sub(r"\s*=\s*", " равно ", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


LIMIT = 1400


def split_part(text, limit=LIMIT):
    """Делит слишком длинный кусок по границам предложений."""
    if len(text) <= limit:
        return [text]
    sentences = re.split(r"(?<=[.!?—])\s+", text)
    chunks, cur = [], ""
    for s in sentences:
        while len(s) > limit:
            cut = s.rfind(", ", 0, limit)
            cut = cut + 1 if cut > 0 else limit
            if cur:
                chunks.append(cur.strip())
                cur = ""
            chunks.append(s[:cut].strip())
            s = s[cut:].strip()
        if not cur:
            cur = s
        elif len(cur) + 1 + len(s) <= limit:
            cur = cur + " " + s
        else:
            chunks.append(cur.strip())
            cur = s
    if cur:
        chunks.append(cur.strip())
    return [c for c in chunks if c]


def main():
    src = os.path.join(ROOT, "media", "narration.json")
    dst = os.path.join(ROOT, "media", "narration-speech.json")
    lessons = json.load(open(src, encoding="utf-8"))
    out = []
    for l in lessons:
        parts = []
        for i, raw in enumerate(l["partTexts"], 1):
            chunks = split_part(speechify(raw))
            for j, ch in enumerate(chunks):
                name = f"{l['id']}-p{i}" if len(chunks) == 1 else f"{l['id']}-p{i}{chr(ord('a') + j)}"
                parts.append({"file": name, "text": ch})
        out.append({"id": l["id"], "title": l["title"], "parts": parts})
    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    total = sum(len(x["parts"]) for x in out)
    longest = max((len(p["text"]) for x in out for p in x["parts"]), default=0)
    print(f"Готово: {total} частей озвучки, самая длинная — {longest} симв. -> {dst}")


if __name__ == "__main__":
    main()
