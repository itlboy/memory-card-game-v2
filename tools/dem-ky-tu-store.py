#!/usr/bin/env python3
"""Soát số ký tự các trường trong docs/store-listing.md theo giới hạn của store.

Mỗi trường là một tiêu đề **Tên** (giới hạn) rồi một khối ``` ngay sau.
"""
import re, sys, pathlib

md = pathlib.Path(__file__).resolve().parent.parent / 'docs' / 'store-listing.md'
s = md.read_text()
loi = 0
for m in re.finditer(r'\*\*([^*]+)\*\* \((\d+)\)[^\n]*\n```\n(.*?)\n```', s, re.S):
    ten, han, noidung = m.group(1), int(m.group(2)), m.group(3)
    n = len(noidung)
    dau = '✗' if n > han else '✓'
    loi += n > han
    print(f'{dau} {ten:20} {n:5}/{han}')
sys.exit(1 if loi else 0)
