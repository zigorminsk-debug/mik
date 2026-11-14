#!/usr/bin/env python3
"""Отрисовка интерфейса RouterOS для видеоуроков.

Два вида экранов:
  * Winbox 7 — дерево разделов слева, таблица данных справа, активная
    вкладка подсвечена;
  * терминал RouterOS — приглашение, команда и вывод.

Все таблицы описывают настоящие разделы RouterOS, поэтому на экране видно
именно ту вкладку, о которой идёт речь в уроке.
"""
from PIL import Image, ImageDraw, ImageFont
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = {
    "bold": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "reg": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "mono": "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "monob": "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
}
for p in FONTS.values():
    if not os.path.exists(p):
        sys.exit(f"Не найден шрифт: {p}")

# Размер кадра: интерфейс сверху, подпись снизу
UI_W, UI_H = 1280, 664
CAP_H = 56
W, H = UI_W, UI_H + CAP_H

# Палитра Winbox 7 (светлая тема)
W_TITLE = (245, 246, 248)
W_ADDR = (228, 232, 237)
W_SIDE = (242, 244, 247)
W_PANEL = (255, 255, 255)
W_BORDER = (203, 209, 216)
W_HEAD = (231, 235, 240)
W_ROW = (250, 251, 252)
W_TEXT = (38, 43, 49)
W_TEXT2 = (122, 131, 141)
W_DIM = (160, 167, 175)
MIK_BLUE = (0, 150, 214)
MIK_ORANGE = (255, 106, 26)
TREE_ICON = {
    "Quick": (222, 92, 92), "Wireless": (86, 156, 226), "Interfaces": (70, 178, 120),
    "IP": (240, 158, 60), "IPv6": (128, 176, 232), "Routing": (160, 122, 214),
    "VPN": (226, 118, 168), "System": (140, 150, 162), "Queue": (72, 186, 186),
    "Tools": (198, 146, 88), "Containers": (120, 190, 160),
}

# Палитра терминала
T_BG = (21, 23, 27)
T_BAR = (34, 37, 43)
T_PROMPT = (126, 231, 135)
T_CMD = (238, 242, 246)
T_OUT = (176, 183, 192)
T_COMMENT = (104, 114, 126)
T_KEY = (255, 196, 100)
T_VAL = (120, 196, 255)
T_ERR = (255, 122, 122)
T_HEAD = (140, 149, 160)

# Подпись снизу
C_BG = (13, 17, 23)
C_TEXT = (232, 238, 244)
C_DIM = (108, 122, 138)


def f(name, size):
    return ImageFont.truetype(FONTS[name], size)


def tw(d, text, font):
    return d.textlength(text, font=font)


def clip(d, text, font, max_w):
    """Обрезает строку по ширине, добавляя многоточие."""
    if tw(d, text, font) <= max_w:
        return text
    while text and tw(d, text + "…", font) > max_w:
        text = text[:-1]
    return text + "…"


def wrap(d, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if tw(d, test, font) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# --------------------------------------------------------------------------
# Дерево разделов Winbox 7
# --------------------------------------------------------------------------
TREE = [
    {"label": "Quick", "path": ("quick",)},
    {"label": "Wireless", "path": ("wireless",), "children": [
        {"label": "Interfaces", "path": ("wireless", "interfaces")},
        {"label": "Access List", "path": ("wireless", "access-list")},
        {"label": "Registration Table", "path": ("wireless", "registration-table")},
        {"label": "Security Profiles", "path": ("wireless", "security-profiles")},
        {"label": "CAPsMAN", "path": ("wireless", "capsman")},
    ]},
    {"label": "Interfaces", "path": ("interface",), "children": [
        {"label": "Ethernet", "path": ("interface", "ethernet"), "children": [
            {"label": "Switch", "path": ("interface", "ethernet", "switch")},
        ]},
        {"label": "Bridge", "path": ("interface", "bridge"), "children": [
            {"label": "Ports", "path": ("interface", "bridge", "port")},
            {"label": "VLAN Table", "path": ("interface", "bridge", "vlan")},
            {"label": "Settings", "path": ("interface", "bridge", "settings")},
        ]},
        {"label": "VLAN", "path": ("interface", "vlan")},
        {"label": "Bonding", "path": ("interface", "bonding")},
        {"label": "EoIP", "path": ("interface", "eoip")},
        {"label": "GRE", "path": ("interface", "gre")},
        {"label": "LTE", "path": ("interface", "lte")},
        {"label": "PPP", "path": ("interface", "ppp"), "children": [
            {"label": "Profiles", "path": ("interface", "ppp", "profile")},
            {"label": "Secrets", "path": ("interface", "ppp", "secret")},
            {"label": "Active Connections", "path": ("interface", "ppp", "active")},
        ]},
        {"label": "VRRP", "path": ("interface", "vrrp")},
        {"label": "Printing", "path": ("interface", "printing")},
    ]},
    {"label": "IP", "path": ("ip",), "children": [
        {"label": "Addresses", "path": ("ip", "address")},
        {"label": "ARP", "path": ("ip", "arp")},
        {"label": "DHCP Server", "path": ("ip", "dhcp-server"), "children": [
            {"label": "Leases", "path": ("ip", "dhcp-server", "lease")},
            {"label": "Networks", "path": ("ip", "dhcp-server", "network")},
        ]},
        {"label": "DHCP Client", "path": ("ip", "dhcp-client")},
        {"label": "IP Pool", "path": ("ip", "pool")},
        {"label": "DNS", "path": ("ip", "dns"), "children": [
            {"label": "Static DNS Entries", "path": ("ip", "dns", "static")},
            {"label": "Cache", "path": ("ip", "dns", "cache")},
        ]},
        {"label": "Firewall", "path": ("ip", "firewall"), "children": [
            {"label": "Filter Rules", "path": ("ip", "firewall", "filter")},
            {"label": "NAT Rules", "path": ("ip", "firewall", "nat")},
            {"label": "Mangle Rules", "path": ("ip", "firewall", "mangle")},
            {"label": "Raw Rules", "path": ("ip", "firewall", "raw")},
            {"label": "Address List", "path": ("ip", "firewall", "address-list")},
            {"label": "Connection Tracking", "path": ("ip", "firewall", "connection")},
            {"label": "Service Ports", "path": ("ip", "firewall", "service-port")},
        ]},
        {"label": "Hotspot", "path": ("ip", "hotspot")},
        {"label": "Network", "path": ("ip", "network")},
        {"label": "Proxy", "path": ("ip", "proxy")},
        {"label": "Routes", "path": ("ip", "route")},
        {"label": "Services", "path": ("ip", "service")},
        {"label": "Cloud", "path": ("ip", "cloud")},
        {"label": "Speedtest", "path": ("ip", "speedtest")},
    ]},
    {"label": "IPv6", "path": ("ipv6",), "children": [
        {"label": "Addresses", "path": ("ipv6", "address")},
        {"label": "DHCP Client", "path": ("ipv6", "dhcp-client")},
        {"label": "Routes", "path": ("ipv6", "route")},
        {"label": "Firewall", "path": ("ipv6", "firewall"), "children": [
            {"label": "Filter Rules", "path": ("ipv6", "firewall", "filter")},
        ]},
    ]},
    {"label": "Routing", "path": ("routing",), "children": [
        {"label": "Route Filters", "path": ("routing", "filter")},
        {"label": "Routing Rules", "path": ("routing", "rule")},
        {"label": "OSPF", "path": ("routing", "ospf"), "children": [
            {"label": "Instances", "path": ("routing", "ospf", "instance")},
            {"label": "Areas", "path": ("routing", "ospf", "area")},
            {"label": "Interface Templates", "path": ("routing", "ospf", "interface-template")},
            {"label": "Neighbors", "path": ("routing", "ospf", "neighbor")},
        ]},
        {"label": "BGP", "path": ("routing", "bgp"), "children": [
            {"label": "Connections", "path": ("routing", "bgp", "connection")},
            {"label": "Advertisements", "path": ("routing", "bgp", "advertisements")},
        ]},
    ]},
    {"label": "VPN", "path": ("vpn",), "children": [
        {"label": "IPsec", "path": ("vpn", "ipsec")},
        {"label": "WireGuard", "path": ("vpn", "wireguard")},
        {"label": "ZeroTier", "path": ("vpn", "zerotier")},
        {"label": "EoIP", "path": ("vpn", "eoip")},
        {"label": "GRE", "path": ("vpn", "gre")},
    ]},
    {"label": "System", "path": ("system",), "children": [
        {"label": "Identity", "path": ("system", "identity")},
        {"label": "Clock", "path": ("system", "clock")},
        {"label": "Resource", "path": ("system", "resource")},
        {"label": "RouterBOARD", "path": ("system", "routerboard")},
        {"label": "License", "path": ("system", "license")},
        {"label": "Users", "path": ("system", "user"), "children": [
            {"label": "Groups", "path": ("system", "user", "group")},
        ]},
        {"label": "SSH", "path": ("system", "ssh")},
        {"label": "SNMP", "path": ("system", "snmp")},
        {"label": "Logging", "path": ("system", "logging")},
        {"label": "Scheduler", "path": ("system", "scheduler")},
        {"label": "Scripts", "path": ("system", "script")},
        {"label": "Backup", "path": ("system", "backup")},
        {"label": "Files", "path": ("system", "file")},
        {"label": "Console", "path": ("system", "console")},
        {"label": "Notes", "path": ("system", "device-note")},
        {"label": "Upgrade", "path": ("system", "upgrade")},
    ]},
    {"label": "Queue", "path": ("queue",), "children": [
        {"label": "Simple Queues", "path": ("queue", "simple")},
        {"label": "Queue Tree", "path": ("queue", "tree")},
        {"label": "Queue Types", "path": ("queue", "type")},
        {"label": "PCQ", "path": ("queue", "pcq")},
    ]},
    {"label": "Tools", "path": ("tool",), "children": [
        {"label": "Ping", "path": ("tool", "ping")},
        {"label": "Traceroute", "path": ("tool", "traceroute")},
        {"label": "Bandwidth Test", "path": ("tool", "bandwidth-test")},
        {"label": "Packet Sniffer", "path": ("tool", "packet-sniffer")},
        {"label": "Torch", "path": ("tool", "torch")},
        {"label": "Profile", "path": ("tool", "profile")},
        {"label": "Netwatch", "path": ("tool", "netwatch")},
        {"label": "Fetch", "path": ("tool", "fetch")},
        {"label": "Logs", "path": ("tool", "log")},
    ]},
    {"label": "Containers", "path": ("container",), "children": [
        {"label": "Containers", "path": ("container", "container")},
        {"label": "Volumes", "path": ("container", "volume")},
    ]},
]

# Соответствие путей CLI (как в командах RouterOS) разделам Winbox
CLI_TO_MENU = {
    "ip/address": ("ip", "address"),
    "ip/arp": ("ip", "arp"),
    "ip/dhcp-server": ("ip", "dhcp-server"),
    "ip/dhcp-server/lease": ("ip", "dhcp-server", "lease"),
    "ip/dhcp-server/network": ("ip", "dhcp-server", "network"),
    "ip/dhcp-client": ("ip", "dhcp-client"),
    "ip/pool": ("ip", "pool"),
    "ip/dns": ("ip", "dns"),
    "ip/dns/static": ("ip", "dns", "static"),
    "ip/dns/cache": ("ip", "dns", "cache"),
    "ip/firewall/filter": ("ip", "firewall", "filter"),
    "ip/firewall/nat": ("ip", "firewall", "nat"),
    "ip/firewall/mangle": ("ip", "firewall", "mangle"),
    "ip/firewall/raw": ("ip", "firewall", "raw"),
    "ip/firewall/address-list": ("ip", "firewall", "address-list"),
    "ip/firewall/connection": ("ip", "firewall", "connection"),
    "ip/firewall/service-port": ("ip", "firewall", "service-port"),
    "ip/hotspot": ("ip", "hotspot"),
    "ip/network": ("ip", "network"),
    "ip/proxy": ("ip", "proxy"),
    "ip/route": ("ip", "route"),
    "ip/service": ("ip", "service"),
    "ip/cloud": ("ip", "cloud"),
    "ip/speedtest": ("ip", "speedtest"),
    "ip/smb": ("ip", "smb"),
    "interface/ethernet": ("interface", "ethernet"),
    "interface/ethernet/switch": ("interface", "ethernet", "switch"),
    "interface/bridge": ("interface", "bridge"),
    "interface/bridge/port": ("interface", "bridge", "port"),
    "interface/bridge/vlan": ("interface", "bridge", "vlan"),
    "interface/bridge/settings": ("interface", "bridge", "settings"),
    "interface/vlan": ("interface", "vlan"),
    "interface/bonding": ("interface", "bonding"),
    "interface/eoip": ("interface", "eoip"),
    "interface/gre": ("interface", "gre"),
    "interface/lte": ("interface", "lte"),
    "interface/ipsec": ("vpn", "ipsec"),
    "interface/wireguard": ("vpn", "wireguard"),
    "interface/zerotier": ("vpn", "zerotier"),
    "interface/pppoe-client": ("interface", "ppp"),
    "interface/ppp-client": ("interface", "ppp"),
    "interface/vrrp": ("interface", "vrrp"),
    "interface/printing": ("interface", "printing"),
    "interface/wireless": ("wireless", "interfaces"),
    "interface/wireless-security": ("wireless", "security-profiles"),
    "interface/wireless-registration-table": ("wireless", "registration-table"),
    "interface/wireless/capsm/manager": ("wireless", "capsman"),
    "interface/wireless/accesslist": ("wireless", "access-list"),
    "ppp/secret": ("interface", "ppp", "secret"),
    "ppp/profile": ("interface", "ppp", "profile"),
    "ppp/active": ("interface", "ppp", "active"),
    "system/identity": ("system", "identity"),
    "system/clock": ("system", "clock"),
    "system/resource": ("system", "resource"),
    "system/routerboard": ("system", "routerboard"),
    "system/board": ("system", "routerboard"),
    "system/license": ("system", "license"),
    "system/logging": ("system", "logging"),
    "system/scheduler": ("system", "scheduler"),
    "system/script": ("system", "script"),
    "system/backup": ("system", "backup"),
    "system/upgrade": ("system", "upgrade"),
    "system/console": ("system", "console"),
    "system/device-note": ("system", "device-note"),
    "system/file": ("system", "file"),
    "file": ("system", "file"),
    "system/user": ("system", "user"),
    "user": ("system", "user"),
    "user/group": ("system", "user", "group"),
    "system/snmp": ("system", "snmp"),
    "system/ssh": ("system", "ssh"),
    "system/certificate": ("system", "ssh"),
    "routing/filter": ("routing", "filter"),
    "routing/rule": ("routing", "rule"),
    "routing/ospf/instance": ("routing", "ospf", "instance"),
    "routing/ospf/area": ("routing", "ospf", "area"),
    "routing/ospf/interface-template": ("routing", "ospf", "interface-template"),
    "routing/ospf/neighbor": ("routing", "ospf", "neighbor"),
    "routing/bgp/connection": ("routing", "bgp", "connection"),
    "routing/bgp/advertisements": ("routing", "bgp", "advertisements"),
    "queue/simple": ("queue", "simple"),
    "queue/tree": ("queue", "tree"),
    "queue/type": ("queue", "type"),
    "queue/pcq": ("queue", "pcq"),
    "tool/ping": ("tool", "ping"),
    "tool/traceroute": ("tool", "traceroute"),
    "tool/netwatch": ("tool", "netwatch"),
    "tool/fetch": ("tool", "fetch"),
    "tool/packet-sniffer": ("tool", "packet-sniffer"),
    "tool/torch": ("tool", "torch"),
    "tool/profile": ("tool", "profile"),
    "tool/bandwidth-test": ("tool", "bandwidth-test"),
    "log": ("tool", "log"),
    "ipv6/address": ("ipv6", "address"),
    "ipv6/route": ("ipv6", "route"),
    "ipv6/dhcp-client": ("ipv6", "dhcp-client"),
    "ipv6/firewall/filter": ("ipv6", "firewall", "filter"),
    "container": ("container", "container"),
    "capsule": ("quick",),
}

# --------------------------------------------------------------------------
# Таблицы разделов RouterOS: колонки и типичные строки
# --------------------------------------------------------------------------
TABLES = {
    ("ip", "address"): (["Address", "Network", "Interface"], [
        ["192.168.88.1/24", "192.168.88.0", "bridge1"],
        ["10.10.0.1/24", "10.10.0.0", "ether2"],
        ["10.20.0.1/24", "10.20.0.0", "ether3"],
    ]),
    ("ip", "arp"): (["Flags", "Address", "MAC Address", "Interface"], [
        ["D", "192.168.88.10", "A8:94:1B:2C:3D:4E", "bridge1"],
        ["D", "192.168.88.11", "B4:2E:99:11:22:33", "bridge1"],
    ]),
    ("ip", "dhcp-server"): (["Name", "Interface", "Address Pool", "Lease Time", "Status"], [
        ["dhcp1", "bridge1", "static-only", "10m", "running"],
    ]),
    ("ip", "dhcp-server", "lease"): (["Status", "Address", "MAC Address", "Host Name", "Server", "Last Seen"], [
        ["bound", "192.168.88.10", "A8:94:1B:2C:3D:4E", "PC-NOTE", "dhcp1", "1m30s"],
        ["bound", "192.168.88.11", "B4:2E:99:11:22:33", "PC-KITCHEN", "dhcp1", "3m10s"],
    ]),
    ("ip", "dhcp-server", "network"): (["Network", "Gateway", "Netmask", "DNS Server"], [
        ["192.168.88.0/24", "192.168.88.1", "255.255.255.0", "192.168.88.1"],
    ]),
    ("ip", "dhcp-client"): (["Name", "Interface", "Address", "Status"], [
        ["dhcp1", "ether1", "203.0.113.24/24", "bound"],
    ]),
    ("ip", "pool"): (["Name", "Ranges"], [
        ["static-only", "192.168.88.100-192.168.88.200"],
        ["dynamic", "192.168.88.201-192.168.88.240"],
    ]),
    ("ip", "dns"): (["Servers", "Allow-Request", "Cache Size", "Dynamic Entries"], [
        ["192.168.88.1, 8.8.8.8", "yes", "2048 KiB", "3"],
    ]),
    ("ip", "dns", "static"): (["Name", "Type", "Address", "TTL", "Regexp"], [
        ["router.lan", "A", "192.168.88.1", "1d", ""],
        ["google", "A", "8.8.8.8", "1d", ""],
    ]),
    ("ip", "dns", "cache"): (["Name", "Type", "Data", "TTL"], [
        ["router.lan", "A", "192.168.88.1", "00:04:12"],
    ]),
    ("ip", "firewall", "filter"): (["Flags", "Chain", "Action", "Src. Address", "Dst. Address", "Protocol", "Dst. Port"], [
        ["", "input", "accept", "", "", "", ""],
        ["", "input", "drop", "", "192.168.88.0/24", "tcp", "22"],
        ["", "forward", "accept", "192.168.88.0/24", "", "", ""],
        ["", "forward", "drop", "", "", "", ""],
    ]),
    ("ip", "firewall", "nat"): (["Chain", "Action", "Src. Address", "Dst. Address", "To Ports", "Protocol"], [
        ["srcnat", "masquerade", "", "", "", ""],
        ["dstnat", "dst-nat", "", "203.0.113.24", "80", "tcp"],
    ]),
    ("ip", "firewall", "mangle"): (["Flags", "Chain", "Action", "Src. Address", "Dst. Address", "Protocol"], [
        ["", "prerouting", "mark-routing", "", "", ""],
    ]),
    ("ip", "firewall", "raw"): (["Flags", "Chain", "Action", "Protocol", "Src. Address", "Dst. Address"], [
        ["", "prerouting", "accept", "tcp", "", ""],
    ]),
    ("ip", "firewall", "address-list"): (["Flags", "List", "Address", "Timeout"], [
        ["", "blocked", "203.0.113.66", ""],
        ["", "allowed", "192.168.88.0/24", ""],
    ]),
    ("ip", "firewall", "connection"): (["Src. Address", "Dst. Address", "Proto", "State", "Src. Port", "Dst. Port"], [
        ["192.168.88.10", "8.8.8.8", "tcp", "established", "51820", "443"],
        ["192.168.88.11", "1.1.1.1", "udp", "established", "44312", "53"],
    ]),
    ("ip", "firewall", "service-port"): (["Flags", "Service", "Port", "Protocol"], [
        ["", "www", "80", "tcp"],
        ["", "ssh", "22", "tcp"],
        ["", "winbox", "8291", "tcp"],
    ]),
    ("ip", "hotspot"): (["Name", "Interface", "Address Pool", "Profile", "Status"], [
        ["hotspot1", "bridge1", "hs-pool", "hsprof1", "running"],
    ]),
    ("ip", "network"): (["IP Address", "Network", "Interface", "Gateway"], [
        ["192.168.88.1/24", "192.168.88.0", "bridge1", "192.168.88.1"],
    ]),
    ("ip", "proxy"): (["Enabled", "Port", "Src Address", "Dst Address"], [
        ["yes", "8080", "", ""],
    ]),
    ("ip", "route"): (["Flags", "Dst. Address", "Gateway", "Distance", "Scope", "Target Scope", "Pref Src"], [
        ["AS", "0.0.0.0/0", "203.0.113.1", "1", "30", "10", "203.0.113.24"],
        ["", "192.168.10.0/24", "10.10.0.2", "1", "30", "10", "10.10.0.1"],
        ["", "192.168.20.0/24", "10.20.0.2", "1", "30", "10", "10.20.0.1"],
    ]),
    ("ip", "service"): (["Flags", "Service", "Port", "Address", "Certificate"], [
        ["", "telnet", "23", "", ""],
        ["", "ftp", "21", "", ""],
        ["", "www", "80", "", ""],
        ["", "ssh", "22", "192.168.88.0/24", ""],
        ["", "winbox", "8291", "192.168.88.0/24", ""],
    ]),
    ("ip", "cloud"): (["Public Address", "DNS Name", "Status"], [
        ["203.0.113.24", "abcd-ef12.mynik.net", "enabled"],
    ]),
    ("interface", "ethernet"): (["Flags", "Name", "MTU", "L2MTU", "Mac Address", "ARP", "Actual-MTU"], [
        ["R", "ether1", "1500", "1598", "A8:94:1B:2C:3D:4E", "enabled", "1500"],
        ["R", "ether2", "1500", "1598", "A8:94:1B:2C:3D:4F", "enabled", "1500"],
        ["R", "ether3", "1500", "1598", "A8:94:1B:2C:3D:50", "enabled", "1500"],
        ["X", "ether4", "1500", "1598", "A8:94:1B:2C:3D:51", "enabled", "1500"],
    ]),
    ("interface", "ethernet", "switch"): (["Flags", "Switch", "Port", "VLAN ID"], [
        ["", "switch1", "ether1", "1"],
        ["", "switch1", "ether2", "1"],
    ]),
    ("interface", "bridge"): (["Flags", "Name", "MTU", "L2MTU", "Mac Address", "ARP", "STP"], [
        ["R", "bridge1", "1500", "1598", "A8:94:1B:2C:3D:4E", "enabled", "rstp"],
    ]),
    ("interface", "bridge", "port"): (["Flags", "Port", "Bridge", "PVID", "Frame Types", "HW Offload", "Inactive"], [
        ["", "ether2", "bridge1", "1", "admit-only", "yes", "false"],
        ["", "ether3", "bridge1", "1", "admit-only", "yes", "false"],
    ]),
    ("interface", "bridge", "vlan"): (["Flags", "Bridge", "VLAN ID", "Current Tagged", "Current Untagged"], [
        ["", "bridge1", "10", "ether2,ether3", "bridge1"],
        ["", "bridge1", "20", "ether3", "bridge1"],
    ]),
    ("interface", "bridge", "settings"): (["Protocol Mode", "PVID", "VLAN Filtering", "Fast Forward"], [
        ["rstp", "1", "no", "yes"],
    ]),
    ("interface", "vlan"): (["Flags", "Name", "MTU", "L2MTU", "ARP", "VID"], [
        ["", "vlan10", "1500", "1598", "enabled", "10"],
    ]),
    ("interface", "bonding"): (["Flags", "Name", "Mode", "Slaves", "Transmit Hash Policy"], [
        ["", "bond1", "802.3ad", "ether2,ether3", "layer-2-and-3"],
    ]),
    ("interface", "eoip"): (["Flags", "Name", "Remote Address", "Tunnel ID"], [
        ["", "eoip1", "10.0.0.2", "17"],
    ]),
    ("interface", "gre"): (["Flags", "Name", "Remote Address", "Local Address"], [
        ["", "gre1", "10.0.0.2", "10.0.0.1"],
    ]),
    ("interface", "lte"): (["Flags", "Name", "Modem", "Pin", "APN"], [
        ["", "lte1", "LTE modem", "1234", "internet"],
    ]),
    ("interface", "ppp"): (["Name", "User", "Service", "Status"], [
        ["pppoe-out1", "user", "PPPoE", "connected"],
    ]),
    ("interface", "ppp", "profile"): (["Name", "Remote Address", "Local Address", "Use Compression"], [
        ["pppoe-out", "", "", "no"],
    ]),
    ("interface", "ppp", "secret"): (["Flags", "Name", "Service", "Remote Address", "Password"], [
        ["", "user", "PPPoE", "", "******"],
    ]),
    ("interface", "ppp", "active"): (["Name", "User", "Address", "Uptime"], [
        ["pppoe-out1", "user", "203.0.113.24", "1h23m"],
    ]),
    ("interface", "vrrp"): (["Flags", "Name", "Interface", "Address", "VRID"], [
        ["", "vrrp1", "bridge1", "192.168.88.254", "1"],
    ]),
    ("interface", "printing"): (["Name", "Interface", "Action", "Paper"], [
        ["print1", "ether2", "accept", ""],
    ]),
    ("wireless", "interfaces"): (["Flags", "Name", "SSID", "Band", "Mode", "Client"], [
        ["R", "wlan1", "MikroTik", "5ghz-a/n/ac", "access point", "3"],
    ]),
    ("wireless", "security-profiles"): (["Name", "Mode", "Authentication", "Unicast Cipher", "Group Cipher"], [
        ["sec1", "dynamic", "WPA2-PSK", "aes-ccm", "aes-ccm"],
    ]),
    ("wireless", "registration-table"): (["Interface", "Radio", "MAC Address", "Signal", "Tx Rate"], [
        ["wlan1", "wlan1", "A8:94:1B:2C:3D:4E", "-54 dBm", "144 Mbps"],
    ]),
    ("wireless", "capsman"): (["Name", "CA Version", "Enabled", "Dynamic VLAN"], [
        ["capsman1", "2", "yes", "no"],
    ]),
    ("wireless", "access-list"): (["Name", "MAC Address", "Interface", "Signal Range"], [
        ["pc1", "A8:94:1B:2C:3D:4E", "wlan1", "-80..-50"],
    ]),
    ("system", "identity"): (["Name"], [
        ["Mik-Home"],
    ]),
    ("system", "clock"): (["Time", "Date", "Time Zone"], [
        ["10:24:31", "nov/14/2026", "Europe/Minsk"],
    ]),
    ("system", "resource"): (["CPU Load", "Free Memory", "Total Memory", "Uptime", "Version", "Board Name"], [
        ["14%", "38.4 MiB", "64.0 MiB", "3d04:12:07", "7.16.2 (stable)", "hAP ax2"],
    ]),
    ("system", "routerboard"): (["Model", "Serial Number", "Current Firmware", "Upgrade Firmware", "Board Name"], [
        ["hAP ax2", "HADA24430ABC", "7.16.2 (stable)", "7.16.2 (stable)", "hAP ax2"],
    ]),
    ("system", "license"): (["Name", "Serial Number", "Expires After", "Status"], [
        ["RouterOS", "HADA24430ABC", "29w2d", "valid"],
    ]),
    ("system", "logging"): (["Action", "Topic", "Prefix"], [
        ["memory", "all", ""],
        ["memory", "critical", "critical"],
    ]),
    ("system", "scheduler"): (["Name", "Start Time", "Interval", "On Event", "Policy"], [
        ["backup", "nov/15/2026", "1d", "00:05:00", "read,write,policy,test,ping"],
    ]),
    ("system", "script"): (["Name", "Owner", "Last Started", "Runs"], [
        ["check-uptime", "admin", "nov/14/2026", "12"],
    ]),
    ("system", "backup"): (["Name", "Size", "Modification Time"], [
        ["backup-2026-11-14", "1.2 MiB", "nov/14/2026 09:12:44"],
    ]),
    ("system", "file"): (["Name", "Size", "Modification Time"], [
        ["backup-2026-11-14.backup", "1.2 MiB", "nov/14/2026 09:12:44"],
        ["mikrotik.cfg", "18.4 KiB", "nov/14/2026 08:02:11"],
    ]),
    ("system", "upgrade"): (["Name", "Version", "Status"], [
        ["RouterOS v7", "7.16.2 (stable)", "up-to-date"],
    ]),
    ("system", "console"): (["Auto Detect", "Color Mode", "Max Lines", "Keep History"], [
        ["yes", "auto", "100", "10m"],
    ]),
    ("system", "device-note"): (["Name", "Note"], [
        ["Mik-Home", "Домашний маршрутизатор"],
    ]),
    ("system", "user"): (["Flags", "Name", "Group", "Address", "Last Logged In"], [
        ["", "admin", "full", "192.168.88.0/24", "nov/14/2026 10:02"],
        ["", "viewer", "read", "", ""],
    ]),
    ("system", "user", "group"): (["Name", "Skin", "Policy"], [
        ["full", "default", "api,rest-api,read,write,policy,test,ping,..."],
        ["read", "default", "read,test,ping,winbox,api,rest-api"],
    ]),
    ("system", "snmp"): (["Enabled", "Location", "Contact", "Engine ID"], [
        ["yes", "Дом", "admin", "800000000000"],
    ]),
    ("system", "ssh"): (["Enabled", "Host Key", "Authorized Keys", "Forwarded Streams"], [
        ["yes", "generated", "2", "10"],
    ]),
    ("routing", "filter"): (["Chain", "Rule"], [
        ["forward", "dst-address in 192.168.88.0/24"],
        ["forward", "reject"],
    ]),
    ("routing", "rule"): (["Flags", "Src. Address", "Dst. Address", "Action", "Routing Table"], [
        ["", "", "203.0.113.0/24", "lookup", "main"],
    ]),
    ("routing", "ospf", "instance"): (["Name", "Router ID", "State"], [
        ["default", "10.10.0.1", "running"],
    ]),
    ("routing", "ospf", "area"): (["Name", "Area ID", "Backbone"], [
        ["backbone", "0.0.0.0", "yes"],
    ]),
    ("routing", "ospf", "interface-template"): (["Name", "Area", "Network", "Cost", "Type"], [
        ["bridge1", "backbone", "10.10.0.0/24", "10", "broadcast"],
    ]),
    ("routing", "ospf", "neighbor"): (["Instance", "Router ID", "Address", "State", "Dead Time"], [
        ["default", "10.10.0.2", "10.10.0.2", "Full", "38s"],
    ]),
    ("routing", "bgp", "connection"): (["Name", "Remote", "Local", "State", "Established"], [
        ["bgp1", "203.0.113.2", "203.0.113.24", "active", "0s"],
    ]),
    ("routing", "bgp", "advertisements"): (["Instance", "Target", "Networks"], [
        ["default", "203.0.113.0/24", "10.10.0.0/24"],
    ]),
    ("queue", "simple"): (["Name", "Target", "Max Limit", "Limit At", "Queue"], [
        ["q1", "192.168.88.10", "10M", "10M", "default"],
    ]),
    ("queue", "tree"): (["Name", "Parent", "Packet Mark", "Limit At"], [
        ["q1", "", "", "10M"],
    ]),
    ("queue", "type"): (["Name", "Kind", "PCE Rate", "Rate", "Scheduler"], [
        ["default", "none", "", "", "default"],
        ["download", "pcq", "", "10M", "default"],
    ]),
    ("queue", "pcq"): (["Name", "Rate", "Limit", "Total Limit", "Dst Address"], [
        ["pcq1", "10M", "1000", "10M", ""],
    ]),
    ("tool", "ping"): (["Address", "Status", "Packets"], [
        ["8.8.8.8", "online", "4/4"],
    ]),
    ("tool", "traceroute"): (["Address", "Status", "Hops"], [
        ["8.8.8.8", "online", "9"],
    ]),
    ("tool", "netwatch"): (["Name", "Host", "Type", "Interval", "Status"], [
        ["internet", "8.8.8.8", "icmp", "00:30:00", "up"],
    ]),
    ("tool", "fetch"): (["Flags", "Group", "Url", "Dst Path", "Status"], [
        ["", "", "https://download.mikrotik.com/routeros/7.16.2/mikrotik_routeros-7.16.2-x86_64.iso", "routeros.iso", "idle"],
    ]),
    ("tool", "packet-sniffer"): (["Interface", "Filter", "File Name", "File Size", "Running"], [
        ["ether1", "ip", "sniff.pcap", "0", "no"],
    ]),
    ("tool", "torch"): (["Src. Address", "Dst. Address", "Proto", "Bytes", "Packets"], [
        ["192.168.88.10", "8.8.8.8", "tcp", "1.2 MiB", "1024"],
    ]),
    ("tool", "profile"): (["Name", "CPU", "Memory"], [
        ["management", "12%", "4.1 MiB"],
    ]),
    ("tool", "bandwidth-test"): (["Address", "Status", "Speed"], [
        ["203.0.113.2", "done", "94.2 Mbps"],
    ]),
    ("tool", "log"): (["Date", "Time", "Topics", "Message"], [
        ["nov/14", "10:02:11", "system,info", "user admin logged in"],
        ["nov/14", "10:02:44", "dhcp,info", "dhcp assigned 192.168.88.10 to A8:94:1B:2C:3D:4E"],
    ]),
    ("ipv6", "address"): (["Address", "Network", "Interface"], [
        ["2001:db8::1/64", "2001:db8::", "bridge1"],
    ]),
    ("ipv6", "route"): (["Dst. Address", "Gateway", "Distance"], [
        ["::/0", "fe80::1", "1"],
    ]),
    ("ipv6", "dhcp-client"): (["Name", "Interface", "Address", "Status"], [
        ["dhcp1", "ether1", "2001:db8::2/64", "bound"],
    ]),
    ("ipv6", "firewall", "filter"): (["Chain", "Action", "Src. Address", "Protocol"], [
        ["input", "accept", "", ""],
    ]),
    ("container", "container"): (["Name", "Image", "Status"], [
        ["chr", "routeros/chr:7.16.2", "running"],
    ]),
    ("vpn", "ipsec"): (["Flags", "Name", "Mode", "Policy"], [
        ["", "ipsec1", "tunnel", "out, in"],
    ]),
    ("vpn", "wireguard"): (["Name", "Listen Port", "Public Key", "Peers"], [
        ["wg1", "13231", "aBcD1...=", "2"],
    ]),
    ("quick",): (["Item", "Value"], [
        ["RouterBOARD", "hAP ax2"],
        ["RouterOS", "7.16.2 (stable)"],
        ["Uptime", "3d04:12:07"],
    ]),
}

# Параметры команды -> заголовок колонки, чтобы значение из команды попадало в таблицу
PARAM_HINTS = {
    "address": ["address"], "interface": ["interface"], "name": ["name"], "chain": ["chain"],
    "action": ["action"], "comment": ["comment"], "protocol": ["protocol"], "dst-port": ["dst. port", "dst port"],
    "src-address": ["src. address"], "dst-address": ["dst. address"], "src-port": ["src. port"],
    "gateway": ["gateway"], "distance": ["distance"], "bridge": ["bridge"], "vlan-id": ["vlan id"],
    "port": ["port"], "network": ["network"], "netmask": ["netmask"], "dns-server": ["dns server"],
    "pool": ["address pool"], "lease-time": ["lease time"], "user": ["user"], "password": ["password"],
    "group": ["group"], "profile": ["profile"], "mode": ["mode"], "ssid": ["ssid"], "band": ["band"],
    "area": ["area"], "router-id": ["router id"], "cost": ["cost"], "target": ["target"],
    "max-limit": ["max limit"], "limit-at": ["limit at"], "queue": ["queue"], "kind": ["kind"],
    "rate": ["rate"], "host": ["host"], "interval": ["interval"], "start-time": ["start time"],
    "on-event": ["on event"], "src-address-list": ["src. address list"], "dst-address-list": ["dst. address list"],
    "service": ["service"], "disabled": ["disabled"], "mtu": ["mtu"], "arp": ["arp"],
    "mac-address": ["mac address"], "vid": ["vid"], "pvid": ["pvid"], "secret": ["secret"],
    "remote": ["remote address", "remote"], "local": ["local address", "local"],
    "src-mac-address": ["src. mac address"], "dst-mac-address": ["dst. mac address"],
    "connection-state": ["connection state"], "src-port-list": ["src. port list"],
}


def menu_for_cli(cli_path):
    """Возвращает путь раздела Winbox для пути команды RouterOS."""
    if not cli_path:
        return None
    key = "/".join(cli_path)
    if key in CLI_TO_MENU:
        return CLI_TO_MENU[key]
    # ищем самый длинный известный префикс
    parts = key.split("/")
    for n in range(len(parts), 0, -1):
        pref = "/".join(parts[:n])
        if pref in CLI_TO_MENU:
            return CLI_TO_MENU[pref]
    return None


def _norm(s):
    return s.lower().replace(".", "").replace("-", "").replace("_", "").replace(" ", "")


def _param_cols(cols, key):
    """Номера колонок, подходящих под параметр команды."""
    cand = PARAM_HINTS.get(key)
    if not cand:
        return []
    out = []
    for i, c in enumerate(cols):
        if any(_norm(c) == _norm(x) for x in cand):
            out.append(i)
    return out


def apply_cmd_to_table(cols, rows, params):
    """Вносит значения команды в таблицу RouterOS.

    Если строка с такими значениями уже есть — она подсвечивается,
    иначе правило дописывается в конец, как это делает RouterOS.
    Возвращает (строки, индекс подсветки).
    """
    rows = [list(r) for r in rows]
    if not params:
        return rows, 0
    vals = {k: v for k, v in params.items()
            if k != "comment" and v.lower() not in ("yes", "no", "true", "false", "")}
    if not vals:
        return rows, 0
    # выбираем строку, в которой уже встречается больше всего значений команды
    def score(r):
        cells = {str(x).strip().lower() for x in r}
        return sum(1 for v in vals.values() if str(v).strip().lower() in cells)
    best, target = -1, None
    for i, r in enumerate(rows):
        sc = score(r)
        if sc > best:
            best, target = sc, i
    if target is None or best == 0:
        target = len(rows)
        rows.append([""] * len(cols))
    used = set()
    for key, val in vals.items():
        for i in _param_cols(cols, key):
            if i in used:
                continue
            rows[target][i] = val
            used.add(i)
            break
    return rows, target


def parse_cmd(cmd_line):
    """Разбирает команду RouterOS на (путь, действие, параметры)."""
    line = cmd_line.strip()
    if line.startswith("/"):
        body = line[1:]
    else:
        body = line
    toks = body.split()
    path, action, params = [], None, {}
    for t in toks:
        if "=" in t:
            k, v = t.split("=", 1)
            params[k] = v
            continue
        if action is None and t in ("print", "add", "set", "remove", "enable", "disable",
                                    "export", "monitor", "find", "unset", "get", "check", "start", "stop"):
            action = t
            continue
        path.append(t)
    # параметры вида ping 8.8.8.8 count=4 -> 8.8.8.8 отдельным токеном
    return path, action, params


def table_for(menu_path):
    if menu_path and menu_path in TABLES:
        return TABLES[menu_path]
    return (["Item", "Value"], [["—", "—"]])


def find_menu_label(menu_path):
    """Человекочитаемое имя активного раздела."""
    if not menu_path:
        return "RouterOS"
    target = tuple(menu_path)
    found = None

    def walk(nodes, trail):
        nonlocal found
        for n in nodes:
            p = trail + (n["path"][-1],)
            if p == target:
                found = n["label"]
                return True
            if n.get("children") and walk(n["children"], p):
                return True
        return False

    walk(TREE, ())
    return found or menu_path[-1].replace("-", " ").title()


def flatten_menu(active=None):
    """Разворачивает дерево в список строк, раскрывая ветку активного раздела."""
    active = tuple(active) if active else ()
    rows = []

    def walk(nodes, depth, prefix):
        for n in nodes:
            p = prefix + (n["path"][-1],)
            is_active = p == active
            expanded = is_active or (active and active[:len(p)] == p)
            rows.append({"label": n["label"], "depth": depth, "path": p,
                         "active": is_active, "open": expanded, "top": n["label"]})
            if expanded and n.get("children"):
                walk(n["children"], depth + 1, p)

    walk(TREE, 0, ())
    return rows


# --------------------------------------------------------------------------
# Отрисовка
# --------------------------------------------------------------------------
def draw_window_chrome(d, title="MikroTik — RouterOS 7.16"):
    d.rectangle([0, 0, UI_W, 32], fill=W_TITLE)
    d.line([(0, 32), (UI_W, 32)], fill=W_BORDER)
    # иконка-эмблема
    d.rounded_rectangle([12, 9, 26, 23], radius=3, fill=MIK_ORANGE)
    d.text((34, 8), title, font=f("reg", 15), fill=W_TEXT)
    for i, g in enumerate([(MIK_ORANGE, 0)]):
        pass
    # кнопки окна
    for i, x in enumerate([UI_W - 78, UI_W - 54, UI_W - 30]):
        d.rectangle([x, 11, x + 14, 21], outline=W_TEXT2, width=1)
    d.line([(UI_W - 66, 11), (UI_W - 66, 21)], fill=W_TEXT2)
    d.line([(UI_W - 42, 11), (UI_W - 42, 21)], fill=W_TEXT2)
    d.line([(UI_W - 17, 11), (UI_W - 17, 21)], fill=W_TEXT2)

    # адресная строка
    d.rectangle([0, 32, UI_W, 74], fill=W_ADDR)
    d.line([(0, 74), (UI_W, 74)], fill=W_BORDER)
    d.rounded_rectangle([14, 40, 300, 66], radius=4, fill=(255, 255, 255), outline=W_BORDER)
    d.text((26, 46), "192.168.88.1  (Mik-Home)", font=f("reg", 14), fill=W_TEXT)
    tabs = ["Neighbors", "Terminal", "Log", "Packet Sniffer"]
    x = 320
    for t in tabs:
        w = tw(d, t, f("reg", 14)) + 26
        d.rounded_rectangle([x, 40, x + w, 66], radius=4, fill=(255, 255, 255), outline=W_BORDER)
        d.text((x + 13, 46), t, font=f("reg", 14), fill=W_TEXT2)
        x += w + 8
    # кнопки справа
    for i, t in enumerate(["⟳", "?"]):
        d.rounded_rectangle([UI_W - 90 + i * 42, 40, UI_W - 56 + i * 42, 66], radius=4,
                            fill=(255, 255, 255), outline=W_BORDER)
        d.text((UI_W - 82 + i * 42, 45), t, font=f("reg", 15), fill=W_TEXT2)


def draw_tree(d, active):
    rows = flatten_menu(active)
    x0, x1 = 0, 268
    d.rectangle([x0, 74, x1, UI_H], fill=W_SIDE)
    d.line([(x1, 74), (x1, UI_H)], fill=W_BORDER)
    # окно дерева
    top = 74
    row_h = 27
    visible = (UI_H - top - 40) // row_h
    idx = 0
    for i, r in enumerate(rows):
        if r["path"] == tuple(active or ()):
            idx = i
            break
    start = max(0, min(idx - visible // 3, len(rows) - visible))
    start = max(start, 0)
    y = top + 6
    for r in rows[start:start + visible]:
        indent = 14 + r["depth"] * 16
        if r["active"]:
            d.rounded_rectangle([6, y, x1 - 8, y + row_h - 3], radius=4, fill=MIK_BLUE)
            col = (255, 255, 255)
        else:
            col = W_TEXT if r["depth"] == 0 else W_TEXT2
        # иконка
        ic = TREE_ICON.get(r["top"], (150, 158, 166))
        if r["depth"] == 0:
            d.rounded_rectangle([indent, y + 7, indent + 13, y + 20], radius=3, fill=ic)
        else:
            d.rectangle([indent + 3, y + 10, indent + 11, y + 18], fill=ic)
        label = r["label"]
        if r["depth"] == 0 and r.get("open") and r.get("children") is not None:
            label = label
        d.text((indent + 20, y + 5), clip(d, label, f("reg", 14), x1 - indent - 34), font=f("reg", 14), fill=col)
        y += row_h
    # полоса прокрутки
    if len(rows) > visible:
        d.rectangle([x1 - 7, top + 8, x1 - 3, UI_H - 42], fill=(228, 232, 236))
        span = max(24, int((UI_H - 50) * visible / len(rows)))
        off = int((UI_H - 50 - span) * (start / max(len(rows) - visible, 1)))
        d.rectangle([x1 - 7, top + 8 + off, x1 - 3, top + 8 + off + span], fill=(176, 185, 194))
    # строка поиска внизу дерева
    d.rectangle([x0, UI_H - 32, x1, UI_H], fill=W_SIDE)
    d.line([(0, UI_H - 32), (x1, UI_H - 32)], fill=W_BORDER)
    d.rounded_rectangle([12, UI_H - 27, x1 - 12, UI_H - 8], radius=4, fill=(255, 255, 255), outline=W_BORDER)
    d.text((22, UI_H - 26), "🔍 Поиск", font=f("reg", 13), fill=W_DIM)


def draw_table(d, menu_path, cmd=None, title=None, x0=268):
    cols, rows = table_for(menu_path)
    label = title or find_menu_label(menu_path)
    # заголовок раздела
    d.rectangle([x0, 74, UI_W, 74 + 44], fill=W_PANEL)
    d.text((x0 + 18, 82), label, font=f("bold", 18), fill=W_TEXT)
    # кнопки панели
    btns = ["+", "−", "↑", "↓", "✎", "⟳"]
    bx = UI_W - 18 - len(btns) * 40
    for b in btns:
        d.rounded_rectangle([bx, 80, bx + 34, 112], radius=4, fill=(248, 249, 250), outline=W_BORDER)
        d.text((bx + 13, 86), b, font=f("reg", 15), fill=W_TEXT2)
        bx += 40
    d.line([(x0, 118), (UI_W, 118)], fill=W_BORDER)

    # таблица
    d.rectangle([x0 + 12, 132, UI_W - 6, UI_H - 44], fill=W_PANEL)
    ty = 132
    tw_ = UI_W - x0 - 18
    # ширины колонок
    font_h = f("bold", 14)
    font_c = f("reg", 15)
    n = len(cols)
    widths = []
    for i, c in enumerate(cols):
        w = tw(d, c, font_h) + 30
        for r in rows:
            if i < len(r):
                w = max(w, tw(d, str(r[i]), font_c) + 30)
        widths.append(w)
    total = sum(widths)
    if total < tw_:
        widths[-1] += tw_ - total
    # заголовок колонок
    d.rectangle([x0 + 12, ty, UI_W - 6, ty + 30], fill=W_HEAD)
    cx = x0 + 18
    for i, c in enumerate(cols):
        d.text((cx + 12, ty + 7), clip(d, c, font_h, widths[i] - 20), font=font_h, fill=W_TEXT)
        cx += widths[i]
    ty += 30
    # строки
    rh = 30
    path, action, params = parse_cmd(cmd) if cmd else ([], None, {})
    rows, hl = apply_cmd_to_table(cols, rows, params)
    for i, r in enumerate(rows):
        if ty + rh > UI_H - 44:
            break
        if i == hl:
            d.rectangle([x0 + 12, ty, UI_W - 6, ty + rh], fill=(222, 240, 250))
            d.rectangle([x0 + 13, ty, x0 + 17, ty + rh], fill=MIK_BLUE)
        elif i % 2 == 1:
            d.rectangle([x0 + 12, ty, UI_W - 6, ty + rh], fill=W_ROW)
        cx = x0 + 18
        for j, c in enumerate(cols):
            val = str(r[j]) if j < len(r) else ""
            d.text((cx + 12, ty + 7), clip(d, val, font_c, widths[j] - 20), font=font_c, fill=W_TEXT)
            cx += widths[j]
        d.line([(x0 + 12, ty + rh), (UI_W - 6, ty + rh)], fill=(235, 238, 242))
        ty += rh
    d.rectangle([x0 + 12, 162, UI_W - 6, UI_H - 44], outline=W_BORDER)
    d.rectangle([x0 + 12, ty, UI_W - 6, UI_H - 44], fill=W_PANEL)
    # строка состояния
    d.rectangle([x0, UI_H - 40, UI_W, UI_H], fill=W_PANEL)
    d.line([(x0, UI_H - 40), (UI_W, UI_H - 40)], fill=W_BORDER)
    d.text((x0 + 18, UI_H - 33), f"{len(rows)} записей", font=f("reg", 13), fill=W_TEXT2)
    btns = ["OK", "Cancel", "Apply", "Refresh"]
    bx = UI_W - 18 - len(btns) * 88
    for b in btns:
        d.rounded_rectangle([bx, UI_H - 35, bx + 80, UI_H - 7], radius=4,
                            fill=(255, 255, 255), outline=W_BORDER)
        d.text((bx + 28, UI_H - 31), b, font=f("reg", 14), fill=W_TEXT)
        bx += 88


def render_winbox(menu_path, cmd=None, title=None):
    img = Image.new("RGB", (UI_W, H), W_PANEL)
    d = ImageDraw.Draw(img)
    draw_window_chrome(d)
    draw_tree(d, menu_path)
    draw_table(d, menu_path, cmd=cmd, title=title, x0=268)
    return img


def _term_text(d, x, y, text, font, fill, max_w=None):
    if max_w:
        text = clip(d, text, font, max_w)
    d.text((x, y), text, font=font, fill=fill)
    return y + (font.size + 8)


def _draw_cmd(d, x, y, cmd, prompt="[admin@Mik-Home] > "):
    """Рисует строку команды с подсветкой ключей и значений."""
    font = f("mono", 19)
    d.text((x, y), prompt, font=font, fill=T_PROMPT)
    px = x + tw(d, prompt, font)
    rest = cmd
    # путь команды подсвечиваем
    if rest.startswith("/"):
        d.text((px, y), rest, font=font, fill=T_CMD)
        return y + font.size + 12
    parts = rest.split(" ")
    cx = px
    for i, p in enumerate(parts):
        if "=" in p:
            k, v = p.split("=", 1)
            d.text((cx, y), k + "=", font=font, fill=T_KEY)
            cx += tw(d, k + "=", font)
            d.text((cx, y), v, font=font, fill=T_VAL)
            cx += tw(d, v, font)
            if i < len(parts) - 1:
                d.text((cx, y), " ", font=font, fill=T_CMD)
                cx += tw(d, " ", font)
        else:
            d.text((cx, y), p, font=font, fill=T_CMD)
            cx += tw(d, p, font)
            if i < len(parts) - 1:
                d.text((cx, y), " ", font=font, fill=T_CMD)
                cx += tw(d, " ", font)
    return y + font.size + 12


def _print_table_text(d, x, y, menu_path, rows_limit=6):
    """Вывод команды print в стиле RouterOS."""
    cols, rows = table_for(menu_path)
    font = f("mono", 16)
    # RouterOS печатает номера строк и значения колонок
    for i, r in enumerate(rows[:rows_limit]):
        d.text((x, y), f"{i}", font=font, fill=T_HEAD)
        cx = x + 34
        for j, c in enumerate(cols):
            val = str(r[j]) if j < len(r) else ""
            if not val:
                continue
            d.text((cx, y), val, font=font, fill=T_OUT)
            cx += tw(d, val, font) + 28
            if cx > UI_W - 180:
                break
        y += font.size + 9
    return y


def render_terminal(cmd, menu_path=None, extra_lines=None, comment=None):
    img = Image.new("RGB", (UI_W, H), T_BG)
    d = ImageDraw.Draw(img)
    # заголовок окна терминала
    d.rectangle([0, 0, UI_W, 34], fill=T_BAR)
    d.text((16, 9), "Terminal — MikroTik", font=f("reg", 15), fill=(215, 220, 226))
    d.rectangle([UI_W - 26, 9, UI_W - 12, 21], outline=(150, 158, 166))
    d.text((UI_W - 150, 9), "RouterOS 7.16.2", font=f("reg", 13), fill=(130, 140, 150))
    if menu_path:
        sec = " / ".join(menu_path)
        d.text((24, 48), sec, font=f("reg", 14), fill=(96, 106, 118))
    d.line([(0, 34), (UI_W, 34)], fill=(48, 52, 60))

    y = 80
    lines = [l for l in (cmd or "").split("\n") if l.strip()]
    font = f("mono", 19)
    for ln in lines:
        if ln.strip().startswith("#"):
            d.text((28, y), ln.strip(), font=font, fill=T_COMMENT)
            y += font.size + 12
            continue
        y = _draw_cmd(d, 28, y, ln.strip())
    # вывод
    out = []
    if extra_lines:
        out.extend(extra_lines)
    else:
        out = default_output(lines, menu_path)
    for kind, text in out:
        if kind == "head":
            d.text((28, y), text, font=f("mono", 16), fill=T_HEAD)
        elif kind == "err":
            d.text((28, y), text, font=f("mono", 17), fill=T_ERR)
        elif kind == "cmd":
            d.text((28, y), text, font=f("mono", 17), fill=T_VAL)
        else:
            d.text((28, y), text, font=f("mono", 17), fill=T_OUT)
        y += (16 if kind == "head" else 17) + 8
    if comment:
        cf = f("mono", 16)
        cy = UI_H - 30
        for ln in reversed(wrap(d, comment, cf, UI_W - 90)):
            if cy < y + 30:
                break
            d.text((28, cy), "# " + ln, font=cf, fill=T_COMMENT)
            cy -= 24
    return img


def _print_rows(out, menu_path, params=None):
    """Вывод команды print: номера строк и значения колонок."""
    cols, rows = table_for(menu_path)
    if params:
        rows, _ = apply_cmd_to_table(cols, rows, params)
    for i, r in enumerate(rows[:6]):
        vals = [str(v) for v in r if str(v)]
        out.append((None, f"  {i}  " + "  ".join(vals)))
    out.append((None, f"  total entries: {len(rows)}"))


def default_output(lines, menu_path):
    """Правдоподобный вывод RouterOS для набора команд."""
    out = []
    printed = False
    last_change = None
    for ln in lines:
        s = ln.strip()
        low = s.lower()
        if low.startswith("ping") or " ping " in low:
            target = "8.8.8.8"
            toks = s.split()
            if len(toks) > 1 and not toks[1].startswith("-"):
                target = toks[1]
            out.append(("head", "  SEQ HOST                     SIZE TTL TIME  STATUS"))
            for i in range(4):
                out.append((None, f"    {i} {target:<24} 56  57 {7+i}ms"))
            out.append((None, "    sent=4 received=4 packet-loss=0% min-rtt=7ms avg-rtt=7ms max-rtt=10ms"))
            out.append(("", ""))
        elif low.startswith("traceroute") or " traceroute " in low:
            target = "8.8.8.8"
            toks = s.split()
            if len(toks) > 1 and not toks[1].startswith("-"):
                target = toks[1]
            out.append(("head", "  HOP ADDRESS            UPTIME LOSS LATENCY"))
            hops = [("10.10.0.1", "00:00:04", "0%", "1ms"), ("203.0.113.1", "00:00:05", "0%", "4ms"),
                    ("198.51.100.1", "00:00:06", "0%", "7ms"), (target, "00:00:08", "0%", "9ms")]
            for i, h in enumerate(hops):
                out.append((None, f"    {i} {h[0]:<20} {h[1]:<8} {h[2]:<5} {h[3]}"))
        elif "/log " in low or low.startswith("log"):
            out.append((None, "  nov/14 10:02:44 dhcp,info dhcp assigned 192.168.88.10 to A8:94:1B:2C:3D:4E"))
            out.append((None, "  nov/14 10:03:01 system,info router rebooted"))
        elif "reboot" in low:
            out.append((None, "  System rebooted, please wait..."))
        elif "export" in low:
            out.append((None, "# oct/24/2026 10:02:11 by RouterOS 7.16.2"))
            out.append((None, "# software id = ABCD-EFGH"))
            out.append((None, "/interface bridge"))
            out.append((None, "add name=bridge1 protocol-mode=rstp"))
        else:
            path, action, params = parse_cmd(s)
            mp = menu_for_cli(path) or menu_path
            if mp and action == "print":
                _print_rows(out, mp, params)
                printed = True
            elif mp and action in ("add", "set", "remove", "enable", "disable"):
                last_change = (mp, params)
    # в конце сессии RouterOS показывает изменившийся раздел
    if last_change:
        _print_rows(out, last_change[0], last_change[1])
    return out


def caption(img, title, step=None, total=None, hint=None):
    """Добавляет нижнюю подпись с названием раздела и прогрессом."""
    d = ImageDraw.Draw(img)
    d.rectangle([0, UI_H, UI_W, H], fill=C_BG)
    d.rectangle([0, UI_H, UI_W, UI_H + 3], fill=(30, 38, 48))
    d.text((20, UI_H + 16), clip(d, " ".join(str(title).split()), f("bold", 21), 900),
           font=f("bold", 21), fill=C_TEXT)
    if hint:
        hint = " ".join(str(hint).split())
        w = tw(d, clip(d, title, f("bold", 21), 900), f("bold", 21))
        d.text((20 + w + 16, UI_H + 19), clip(d, hint, f("reg", 18), UI_W - w - 320),
               font=f("reg", 18), fill=C_DIM)
    if step:
        d.text((UI_W - 130, UI_H + 18), f"{step}/{total}", font=f("mono", 17), fill=C_DIM)
        bar_w = 100
        bx = UI_W - 250
        d.rectangle([bx, UI_H + 30, bx + bar_w, UI_H + 34], fill=(48, 58, 70))
        d.rectangle([bx, UI_H + 30, bx + int(bar_w * step / max(total, 1)), UI_H + 34], fill=MIK_ORANGE)
    return img
