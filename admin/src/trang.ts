/**
 * Giao diện admin — HTML + CSS + JS thuần, phục vụ từ chính Worker (CSP 'self', không script nội tuyến).
 * Theo mockup đã duyệt 17.11.2026 (https://claude.ai/artifact/VdBjJtK6bNfLz1AXFcjRB9): nền arcade tối,
 * ô/nút nổi khối (thạch) như game. LƯU Ý khi sửa: JS dưới đây nằm trong String.raw — không dùng
 * dấu backtick hay "${" trong đó.
 */

export const HTML = String.raw`<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Lật Thẻ · Quản trị</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap">
<link rel="stylesheet" href="/app.css?v=__PHIEN__">
<script src="/app.js?v=__PHIEN__" defer></script>
</head>
<body>
<div class="thanh-tai" role="progressbar" aria-label="Đang tải số liệu" aria-hidden="true"></div>
<div class="khung" id="khung">
  <header class="dau">
    <div class="ten">
      <!-- LOGO = icon app Lật Thẻ (apps/web/public/icon-192.png thu 112px), BẤM ĐƯỢC về trang đầu (19.11.2026, chủ dự án).
           Nhúng data: vì CSP chỉ cho img-src 'self' data: — đổi icon app thì chạy lại: sips -Z 112 + base64. -->
      <a class="logo" href="/" title="Về trang đầu" aria-label="Lật Thẻ · Quản trị — về trang đầu"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHAAAABwCAIAAABJgmMcAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAcKADAAQAAAABAAAAcAAAAADeglGxAAAdIUlEQVR4Ae1cCZQcZZ2vr46uvrunu2e658ycSYAYAgEEBGSBrIuoaExAENigPlb0qSgg6+qu4oq7CoK6KuriKjwUdRdl4aHgAuEQuZMQQhIyk0wyd8/V03fXvb+vemaSnsx0qmY64cXXH82ku+qr7/jV//7/q4jxymqm2iqHAFu5oaojUQSqgFaYDqqAVgGtMAIVHq5KoVVAK4xAhYerUmgV0AojUOHhqhRaBbTCCFR4uCqFVgGtMAIVHq5KoVVAK4xAhYerUmgV0AojUOHhqhRaBbTCCFR4uCqFVhhQvsLjHcvhQAzEYIg5pcEwOmHw9+1uxyGgQJA1kLvJpLj4lJAtsA7B8Lu0sF8VPTrF9ODnbYD4eAOUMwyVHBgRf/VMaPPr3vEkn5VYkTd8bj3kU5dF5ZOaC61RqatBigRUj1N3uHSKvkYYHUAfC3zJ8ZRG5ozBccddv6v73Z+DOZlKf47+Mcz/iI5/QbgswxJG4I1ldXJ9jdIUkU9cBojltqjUGFYcvMFw5gfyARDjb6Xb8QOoYOwfEK+9c9nOfifw0jUdjWWJ2yWqml6QZIoMmJ0AUBbHdYPVdEbTCehXdOiiYADfFU2F9nq5o15qj0m1AbUhrBBAPNsqQcXHCaCc0R8XP3Zny+u9blHQFEXraKu79OLTzjmzKxz266rWNzixp2d4d89w74GxyUR2YjI9lcoBKA7YAl1CGEJAv8BXB1USJuxTAx4Nf09okdpiUle91BqT8TPiVxmHzqgspd9FteMBUMKoOnPDj5t/80yNy0FJ86rLzr7h+vfW14dnFBC2Ps28uqyMxKcG41MDQ5Pde0f27Bvp7omPT6YKBSWbl1RV5zgWH0JYw6BSotiANfBtCCktdcq6U1Lvf2cyGFQZdTEy920FdEZfU1ZFK2KiHSbaBP2Jl4Mf/16LDtJRtU9c9e6vfWkDJ3CMiq6HNRAjhCihJhUGQh9ZUYeGEz29owB33/7R/oGJvqGJkZEpRTXFBogW6M5ADCkBKbyisXDLxvjFZ6To6DZJ9ZgDOms8EqOQ4/rHHPtGxKEJAftyi3prnbSyuRAKqcwsrKby+OT3Wh56McgTdUVn7H/v/7w/6AH3HoblAgcOQswxjCbnC5mslEhk9uyNv9Uz1L0v3j80OTqaHBlL5XISyxGe5yCcOda4/pLxGzfEIYKn7/cCw885fEzMpiIlYjsGk81wY1P81r3uLXvdr3W7hiaF4UmKJnYNvgOmUBcXnJz5+HvGG6MyZTpiTCSEN/a7eM5QFW3TFef5a/yMqszZRrmfVHaCBXADVHRzOISQ6AhF/B1djRcza3FEyuXHxlNjk+k9PSOPPbn96T/vkjQFpsBdD9VB4H7l6iFqdc0Ih3ITmeeOGoVOg2gAFEVhe0cc2/e7XtnjefOAEySZSMN4oQ12DxTyzHqp36PqBPiCVG/+cHzjuxMw4F/b5fnA1zuIoQUC7v/5+WdPOLF5fmY3B1zMH4gI8HlR4ujaE5t3/OsdD0E+cBzvFPR7Ptd3/toUoxTl0ZGHryiFYlWwos2mSOy+EWfPkPjSbs/2XteufjEvswUZKtcArQk8XJpiT0J4keWddEuaoik5gdEEjkAU3PSzpvGUcP2H493DIqQnyLsu4o/VBWYuPPLerPaAbtJnxDFhLrrwlObmyKbrf3xgYDyt8nf8ru6MlVm3U7coTJcMaJESTcmYTfHDCWHHfuer3Z4tPe7+cWEyzcsw9XiDp0AbTgG8B/ZmgSDhXbwzwDmDrMNDOJ7ytqHrSl5JD+MjcJqmsf/222hzRB4cFwCNrgPQQDDssyE9rSJ6SD8sU5VXLG+++TPv/eyX7ueIsaXH9eIuzwWnpSx6AYsFFDgKsJtJLsdBCEIgbtvr2rbP1TfmGJ0COlTNssTAx+UAiAZhecIKrODhXUFODLAON8u7YBuaW5mW+oRwnFPgXAHeHc6P7WKpfma//WAUFA26BkF3dUTRx7bePQQuq1919eJ1a0594LmXt+4zGOHJ130XnGpqfAvX2wcUxMgZE5PCM294n3vTs2fA2T0kIkIBwYfpQIkigC6yMzQN5+CcAV70s6KPc3jx0wQRPU0/cZrrD1kmpWOD99a5GCYX3yHwGoQvjkHU6hpZ2VlPLzwGTdddHu9Zp3e9tHUfBOz2fS7r09oElDOyefa/nw399I+14OiCxIJ88AFrcJxpxwBE3skJbs7pBztTEFkB5EmJkMI387c8KLrGe2oFTy14H+MVyZiwZDkF9Jg1fVlzhOdYiO90jlMVulMrc9sBlDfGJoWb/rPxsVf9HAeqATurYEXQIWQiS0E0ZaLgoiKSRVxoGj7DmBH5VlY03cdw+BuUzGiRJCFAQ0FPQyx4jCjUXANuJPVSYQibPis0gRU6tQwoZ4xP8Z/6QfMzb/gQa6COMctyzjDvquEcYGcPEZzTlodJhohe2EDv8K4Y3uFlBZcuZyEloKGaG8J+vxu66fC+R+cI6RuaRNgFKjTo1USHRqN/FppVQGHi3vbLeqDpROzA0DlXjTPUDvXCsNASoBtrvGxhQTNdqB7jRL8upyFCVc1orA/6vDZk2cw4i/3X0Pf2jugwNXgezht9FsEahaCjhcYbf9nh/f2LAQdVODrvibhjqzlXmGoYgx45GpwIoQEZUkxxQDO0LqslvGNa3VlY8pK6sCSTygwNT8EDBUt01ktFq9/KmBYAhRBRyT2Ph+HpsowBfe2MnED19WIko5UlTfeBCIZ1RRWaYTgcfFd77AgGE5V5EHlU6i21sexkIjMUn0L0D0pxeZMNQC2wPDEODIsv7PLQMAFhxGALRNvRRrOICORXUS6LDn5Fx8KA8jyjaaoCiUflnABPS3AwmroEciaj46n4WBLSpiEkt9TKFt0kLNsCoByzbZ8bjiP42rQra45AKUslj4PXG5qCOwf57PE4W1tq59FINFJHtrzWc8+vnt2xZ3B8MoNY56oVjVetP+vvLlzNOfhprx92LL03aKastxCp6ukdQ/AUUqfGpwXcuDcHV1X+mwVAWWNgXFBUQj0WDn63uIQ7X34xJWfBa5qchbWgaUxHa53HDSFT0gFQgiRv//4jP7p3s6cgr3I71gisLDPbn9/50c1vXPXBM796y/raWj/iC8ODY8PxqUQyVx8NNsaCgVAAUoxaQws3RPZA7BCg0aBSE7Cq4jGeBUAR4FIQBzJbUacvvI4KnqFpIyVLYdW05e0x3iGU3EgqMZlv3fnw7T/906V+51c7wm0IOZstrTP3T+W/8fsXETH6yXeufejRV+998IX+/nFcwYnCivbY3557wo2futjldSNevcCCjbd6hjE+BPLKJomFYSNZUDbmWBYANZiQTzPzi+A/8CAkKdZ29JuhG0oB0yAZ19kRQwClJAzKcbt29v3ovqcvDbi+G/MFuZkQIMP4CHN92O1hyU27Bj646fvx4ckLPOJnGoOAZEDRXjkQv2tnX8/+sW98eWNTQwjCd+5OWJJN5RDkB56QKJ0NksWwSHEcC4DqBIMi0ahpiElKoBoo+hJimbuiivwmBnJvYHmGuFxiW0ukZFCCGKvx/XueECT51qbIoWhOd9ONj/idT+WUV8dTtzcE8F0oEgFhpLD7oYz85ce23JAp/OIH13k9h0kwlh0cSkA+QMMjKIMU6VxRU7KUuT8sULJG3rEsH/LCy6QUqskZxGPnDlPx3wTR0byhK3A6gwF3Y6xUE1IiyrzRPXyuR2wBp88nDB2E+V7U+2hL8OqAi4b/iq6HboiEXB5w3tIUfPy5Nx957DWGoydLGzs4kkhMwUNjfW4N+X3rKh7jWIIm4NXWdOQQS8cFWiGFwGXpCo7GL6IryAPDBjUCfndTY6hExROCLGYqW2iChQS2XKAFWLLMAbgPw1s31vvE1S7Hg3/YIuXzNKlX2g70j2VzEpzD1jrZ77GhkTCMBUCpW22c1plTkVphiCYlGWMhWV66rnl+zV36PF3MQ5BfupwD6QEN6GUv9eJLcJFkJZstFGiPhcYwjy9wNsxz64KuF7fsHRqanKsSdBX5O5hfMK7qQ4pLtEc9FgA1F3ZKR97vxhTUlNGhKxajl0DZVpNrCFDpSqZIoSu66udOp+mxaOjkFY3Pp6UkXVRZTBc42SpwSBGMwHo/dC8wKhRtz94R+EiIo7XFZBaALnBX5h3YGqAa1Usov6JlF1AWBbgQNjdBWMSNsoNblNTQjI0973qKB6GRFF2VMAtk6AoaBi2dzjBEt+vs0zr7VX2ntCh2IcwuSRWdDiqdD5UJhMnkJKTvkfxCHmnVsoItFY/VWwNUZ2pDSkdMolODeKRk6f7KQDN9Cv01Ka3kp3ITvVphyvQpF74Kdw2OI0w004+EVT9PV0PZ+IEzaqLBnyXyNElss6VV/S/pwhmndjTU15QIE8Lu7xvLZKm5hnIo1JLYIk9cZQ1QdCTMmStzRZ9Nl7K6huIsG6hCt8i59KpW5dwTJqYGd0NulNKpaUMfZD1iqAVQKLzOaCRQVxvAbZyLmKYva41u2nj2H6Zyr+YVO2uhm/73idyOnHLJ+as4R6nZRFgU8BQk3EviEXW7RqgdQBnm9OVZOMdQUZqSBduXiJ65253ntyzlz3tH5s5/GFwZG08O7aIhLGTu4GJDtFLzNo/P7GUwzgCipunRqL8u4ishotlOhnHl+rNqYjXfGMvYIFJCnsjIv5jI/P3l79rwwXcS+KAljUUtSaEgI8zS2VCo8cFDLTl9xB+WKVRn2mNyS51Ek3G6qkvYsPVGKU6VMvUhNVYvfXPTiI+fSAzsTI50Tw7snOjbkR18LTvwSn74daq1TDo1bSZYSkZ9rMbrB6DzbUvTGpvrvvCJdc9O5X82lbdEpIQ8lpE+cSBxwkktt/7jRrgMpQIUnovc2zcGbwJ3CCY9Ssqsb7LY04KnVOxoEIhRaL29wyLPMmphSvA3WJoMABFOlXMCq8JUQKXgWavT/3zl6D2PKbV+1S1qTRGU2LAPPB1gPbWEww6htSGm6Q1DCVcnBOhBUXDYhIZ22YfO3PzC7q9t3tEm8Ou8C0egTfn0w8nc7SOpYEPorluvCKBAak5JD2Fy6fzgcILniKIREBBjP2ltHVBEFvTTu3JPve6DfNElJP7VUjk4Z7fUFaZsW0hK6Yn01MRpbdll9TJNJBjsR8+ffN8ZSdQm0pJin/bF7zapXMgX7jTpBeQsg1IwC4xBU8XPR57F2TTdF3B/52tXvLf7zltHEh0tofZ5LXlCxlTtW+PZexP5S9atue2fNjQ2heeiiQEJSWUKfQMTyJaJnEEFKA0K2VAVGMMyy6OvRtZ25ZDsxFeqMeDJTAcZcWBuM1CoObU/NbAtN7w1wu6+7sLeH1w/EEI5KzW8aOeAV8XDBqhufeCR8IN/CXvDzajJocqHQKxJsM3Qi+M4M3VsXjB3hpnfqhatr/n2Vzb2O4TrBpMIf5QgQJi8wTycli49kLgvVfj4Fef85K5rTTQPi4lgPEKGRqZMp5NE/ApKyGmZmM1mmUIxrk5ObCnU16gomUNZhy5nUMEw316xCD0/ujOfHFvZLH/livg5q3KiaG4A1XSzDciyxuiE4z8eDquuDrc/WkyUUh9JLSBoANYPR7z1UcQu55tkdhx8UbULL1hzxz9fdsOtv/n8cOruBn8EUgnNYF7KK7eNZZ5LFVZ2Nvzqix+68LyTkPNeuNaM3d09hOCWwfBBrx6rUewaoZjTDoUajN+tLm8sFAtdTad+3q3iIIpuopzoRcx7z6BIayBA10BwTmOZ3z4d7InXeGpqZ11IfEFAi2p+naaOvW6TbOdcePhPTdm4/uzbbrr0iaz06eH0uKq/XlA/OZTc2DvZ7XTeeN17Hvv1jRddeDJ1/OfVb9MDEthMOo0fMI0hOQB+mnd/h89+yBE7FIoyH7e+ui3/f1v9oCPoJUjIBbjeEHyxgDvUP7H/tt+6H33Z96n3T150atqB4ovSJcIV8bkgPWTcAUpRaPAH5RziyihWbm4MiW4nVVNHbLhU066+4vyx8cy37/7j+w+ocVkVI4FNm87edPk57Z0NdJAFw8nTo8Nlgc2EMCwKqFa12kgdH7o6O4DiOp2c1pXzujQZzGtajqzoLbE8DhkbMtEbXakFG7ePDl5zx8gtG4Zv/ujIdOgbBIt8mkbOPTlzQmPm9aH+gBvWu9lAnCrkHu4UaUPqmBUY6oNaaIYBbr75c+8Lhzw/vG/zNRetuQZQ0lwpalTnGJvzjcaxycl0fDRJKy4ZphmJOfP+zte13DGbgGoMKDTg1saSMPE1VUo6EGxeaGbTUeVEnz+2UlHUPQMT0wIGtWYJwefSHE6dE41r1yU+fbdPy01y7gjoiHrx8KMQV3Y6OtvgdFogz9kNQvoR5mPX/M2VG852QlbA3rICZfFyQjOdoxMpxJWBJCTb7Ki2vtgEVCe1QXV1e/7x1/wCkj2FJPE3HeFGUoYFtSGhhrAfIQ5986uBL/8iBmvh9OW5s0/KrWyWVjZmepNjfncE5SIw6UGjEGNut4Pm4q3w+6E7xl3UDKcTaWQ7d4KOwOLxkfGJNEq1ELVritj24oursAkoLuKMtZ35R18OOBAxpE69Ag9yQSItToLFsiSZ44hKntzm/9yPG5J6i+D07ntp4v6nM8tqs7mCoRdGNLnZrL1BGBSAMgGfGyxfVofMjH74v5Q57DajpzeO3D7H89EaBbFKi8VMc6axDygx1nZlvU5oYQTVs4Yq4Vm1hZi+OBlSM0joC6zx6Ev+L/5XQ4ZpCjasBDG6Q02wkBL5jK5OCG6TxSDu5DSUA/LDCDKB6xcS0HO2UYGfhr67exhhUIQo8cydF4H6w80SC9PYB1QjbVEZNhqKlXmiqXLKAb1UHlFkqzljZ794y88bckKnL9JKRZ3JyyhCcUK/+yA9cQwxXQWZTmqK6noXSkWgZWxzroVNz9vFMBBXhnWBR+46G2QCp0M6zM6b98LSg3bs0OKVuIG1cns9Ui6A0dDzU1amhRM5mebyQqentt00fmdYEjgWa6RMhx0mE3Q85gH9L++IwvksXe1R+wWJNJVFMRPghG2HB78WR55Yn31AqYpBKA9+J92eJqd1CkE5VAGTw9/obVzrCrfSa8qRM6QnfCqqZ5GbKz+sOVSF/rAcXPh0Jg/tyXM0zmTLuDh0EYsBFIDAGjVzhcjAFAzEMcvhSRFEGAlFkBSgI6gLDETHwv8TCRoSPXStR/M7i2dD02kqx0M+Bc/dL04j4fJFAoon/JsjimawCAuBSC2QEnUpj4QILbKltVOMwfPsK1t77RmhRxq97Hmjt28ccWVNZ2HGIVa/6Fu5KEB1EgkoHfXUqQcpqXnk7CpDSrABUWSLnfM8/8zzu7vfGsS3skBU4iTUkKp07xtBeS1MFzwZxUMjLXZDiwIU0RiXvrYrD0UC3awjCVou4mBjz1BygqeOcAJKe0fHknf88I8K0jvFuiobw9jsShjQJsIi0JwQSMsbJYJC7cW2RQGKyTRySkeOluBSjYyMEHQUlX1LbgYMKRTwQ9SiavmRx7d+8zsPSUgU8wKFtSIzzLfEbFba3z+OWiafS7dbzDRnvMUDuqY9j4AxKLSyBU9I2wneaHGVHEd+ct/mTdffvfmZN+AUUkxRZg8hAE2M71CLFbmLLL99Zx9UPEbzOOlrCBZtM2HZi5dQAQ/NET36st/Ba5qUMryI61Sgget5VwjP1CCADXCRVtr8/K7nX+7ubIu2NIXhjCIpsrwjhsiex+10IwICiKnAo+8XOZIJMd/ycEt0/cFHXilIKssJ0LR4V8bbASieJxcNcP3DLwQIzyLYTAueKmSHw08Va9oQ8wdM1NJGKaVh7Ooe2rF7AEEWvCAAriyeA+toi8I97WiPtjZHljWGUVCGynEakKeJGUgHPD+Mz5GUCyc8tXnb45t3oDIfdcWXnJ4UoOIPzSzMdxfKHFs8hWLQU9rzeGESisiQRkci6GCQuMyEVk5BNXmjCBRIiV6T+qg/KPAcPrNXo5w+PpZ69oXdUCNul8PjFn0eZ0tzeGVXQ1d7tG1ZHXIn9dEabwBx62IDssgaFNU3BFXxGXnuz8/vuOmrD+TyMqKpsAU3nDu1aJO+OM0SANWoQsTrp0aQdkU4o5AEny6G6WZ2XPqvASLFY6PS5F7cKgjLOeISRIrcJMgKV4F+05lCKp3Hyy6ee+EtBFacohAJ+yIhL56vR60ZEkqd7dG6Wn/Q7/b48BQ0J+el4ZHEbx566d5fP4e36HBIHBPjpvXxGKpBLb9roHTB07+W9kYH1rjqW21PbvPxnCr6m5x1J1qw3uddxgIHaYlZRsnE1dx4sa4EXqxJswv0nzkMiGlUAB/6KCq9GzCJ8P4C1IDHogFQOlQcZMjoWAoeBCQ1zM8b14/euHFkEWnOmTmn/10ChWIEwpzakfvTFj/qXmm5Esq7LMRG56yg3E/wIZ4LF31GTRskgIwkcQY5Hxo6QH06VSfgYJOPKQdTJsYT+nQ8nIOFgCd8D21xVADFEzp9TAcP4LOAFZYZBAHeM/GRdyduWB9fii6anWhpgCJKsiJHdQbMeyUDg5TFowVHUgOzcy/whVIUxYRauKhAz6PsBwlBlFagSByhKdBcQWHPW5X5yhXDowmhe8i5a0DcP+LA2yPGU3wiA7tgGlmayzCBLk4EXYYPc0gJOO4Hhrpgdfrr1wxR9OfL1S+wyAUPLw1QnUGNI94vh1eEIH2DOkXWgRTTotZFCY7mmpGpMguhkhgNySUAyphluhQb+qwCfW798vMS/3LlcF0tDEbmPQQVsyjt40aT/FhK2DfkwAsRsB68LWYizeNxykyeg0GFNyMAMjP/RrFAXEFWWbxt8OoLJm7eEKdFYfZrGuYFdWmAaiQWkU9qKeyPOyCL5NQw0vEMJVJrVFosPKEsCOJOQ63BnqUGA/wu7NgchBb76RQRSluccc5J2U3rJt73ziQFXzbZm24LppXRVCc3ReVTlmepmjaIIpPBCQE1Gb1xEe+SwQpRlYUn2JAkhv4JBbVzTsxcdt7Uu07M0GBhhdCkS1nq2xkF4/EXAx/77jJaooPC4po2MdxhYjEvptPsTEHQwc450CDYGVCiPIzSJhVjLKrFkIcoykdIOTyHgSI1FFOesTx3SmdOxBssrShioI0lwSTFX7zqSGbxdCXeh5LMckGPBpKs8Wo0LG9lKLpcq21pFIpZVHL+yelzT8o8td3rFBgpeQDk4Qi2IsBxUONTGE284fWrsi4l1TzYGaYrSm5oURhlZ4BoIDPKw6rFa+hqAwrKfta051Ce1lYvx4IKA3sbdISPRQhwQ2l/LJESMgQ93mDi984k6IvvErU4lFUwab8lUyjG4I239juvvqOtb0ygatN8PYHgq8fLHmiZAsgVxaH5KZOd8cADWLIoZCnMiD/iKVKINrdDDwdUxAdO7czBo22PSnWo1QJ9ARd8QLjzUrydrR6bvpUA1MT02W2+L/y0CW92AaawZ6iWRrQYVhQ1CZHjpql2QAhihNFXlImQEi21iKtKiP+f3J5b3Vao8eIZXZNegfmiko7HBrUys1QIUBPT7n7x679sgJ0P65vjihY16Iq+nwRgoiYYxqPXpTeGZaQVT1+RXduR62qUACKL93YV2fk4IcNjAqiJaS7PPbXV98DTNW/2udI5VlJopRBeEQixiBoe8DKIsaVOjoVkGueCOjY18vHCzmVwnD1VOQotDlnUqjoZHBN6R8RUDhENPeLX8KLpGlQH4iwayBD0+FfaKg3oLEzQ6vA9IDPRIA3pZ/bcX/OXJZtNC4EzjeBfLSUutO8iEy50tnrcNgJVQG1DVv6CKqDl8bF9tgqobcjKX1AFtDw+ts9WAbUNWfkLqoCWx8f22SqgtiErf0EV0PL42D5bBdQ2ZOUvqAJaHh/bZ6uA2oas/AVVQMvjY/tsFVDbkJW/oApoeXxsn60Cahuy8hdUAS2Pj+2zVUBtQ1b+gv8H8fhxTt18GwMAAAAASUVORK5CYII=" alt="" width="52" height="52"></a>
      <div><h1><span class="h1-dai">Lật Thẻ · </span>Quản trị</h1><p class="phu" id="capNhat">admin.cozypi.com</p></div>
    </div>
    <span class="song-nho" id="songNho" aria-hidden="true"><span class="cham"></span><b>–</b> người · 30′ <span class="gn">GA</span></span>
    <!-- GỌN (28.11.2026, mockup https://claude.ai/artifact/J2BXe9eA3KK1Dog2eC9M44): điện thoại chọn khoảng bằng MỘT nút luôn hiện
         khoảng đang chọn → mở tấm chọn trượt từ đáy (.dieu-khien). Máy tính giữ hàng chip. -->
    <button class="nut-ky" id="nutKy" type="button" aria-expanded="false" aria-controls="dieuKhien"><span id="nutKyChu">…</span> ▾</button>
    <!-- NGAY LÚC NÀY: luôn là 30 phút gần nhất, KHÔNG theo khoảng đang chọn — đặt cạnh tiêu đề, tách khỏi
         phần thống kê (17.11.2026: để dưới hàng nút thì bấm "Hôm nay" vẫn thấy "30 phút qua", gây hiểu lầm) -->
    <section class="song" aria-live="polite" aria-label="Ngay lúc này, 30 phút gần nhất">
      <div class="song-tieu"><span class="cham"></span><div><h2 class="ktieu">Ngay lúc này</h2><span class="phu-nho">30 phút gần nhất · cập nhật mỗi phút</span></div></div>
      <div class="song-so" id="song"><span class="sk" style="width:110px;height:28px"></span><span class="sk" style="width:110px;height:28px"></span><span class="sk" style="width:90px;height:28px"></span></div>
    </section>
  </header>

  <!-- CHIA TAB (28.11.2026, mockup duyệt https://claude.ai/artifact/99GPQHggzVe1WBuApjcfQU): mỗi khung mang data-tab; khung
       ngoài tab đang chọn bị ẩn (class ngoai-tab) nên bộ tải theo IntersectionObserver tự chỉ tải ô của tab đang xem.
       Máy tính: hàng tab dưới tiêu đề. Điện thoại: thanh tab cố định ở đáy. Địa chỉ nhớ tab (#nguoi, #online…). -->
  <nav class="tabs" id="tabs" role="tablist" aria-label="Nhóm thống kê">
    <button class="tab" type="button" role="tab" data-chon-tab="tong" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg><span>Tổng quan</span></button>
    <button class="tab" type="button" role="tab" data-chon-tab="tangtruong" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg><span>Tăng trưởng</span></button>
    <button class="tab" type="button" role="tab" data-chon-tab="nguoi" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M16 4a4 4 0 0 1 0 8M22 21c0-3-1.5-5-4-5.6"/></svg><span>Người chơi</span></button>
    <button class="tab" type="button" role="tab" data-chon-tab="choi" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="8" height="14" rx="2"/><rect x="13" y="5" width="8" height="14" rx="2"/></svg><span>Chơi</span></button>
    <button class="tab" type="button" role="tab" data-chon-tab="online" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/></svg><span>Online</span><b class="so-tab" id="soOnline" hidden></b></button>
    <button class="tab" type="button" role="tab" data-chon-tab="kythuat" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z"/></svg><span>Kỹ thuật</span></button>
  </nav>

  <div class="nen-ky" id="nenKy" hidden></div>
  <nav class="dieu-khien" id="dieuKhien" aria-label="Khoảng thời gian thống kê">
    <p class="tam-tieu">Khoảng thời gian</p>
    <div class="chips" id="khoang" role="group" aria-label="Khoảng thời gian"></div>
    <button class="chip" id="nutTuyChon" type="button" aria-expanded="false">Tuỳ chọn…</button>
    <button class="chip" id="nutMoi" type="button" title="Bỏ qua bộ nhớ tạm, hỏi GA lại">Làm mới</button>
    <a class="nguoi" id="nguoi" href="/cdn-cgi/access/logout" title="Đăng xuất Cloudflare Access">Access</a>
    <form class="tuy-chon thach" id="tuyChon" hidden>
    <label>Từ ngày <input type="date" id="tu" required></label>
    <label>Đến ngày <input type="date" id="den" required></label>
    <button class="chip chon" type="submit">Xem</button>
  </form>
  </nav>


  <div class="bao" id="bao" hidden></div>

  <p class="ky-chon" id="kyChon">Đang tải…</p>

  <!-- MÁY CHỦ · TRỰC TIẾP (28.11.2026) — đứng ĐẦU tab Online (số trực tiếp trước số GA): số từ API quản trị cụm của MÁY CHỦ GAME (/api/maychu), 30 giây một lần -->
  <section class="thach the" id="mayChu" data-tab="online">
    <div class="the-dau"><div class="tieu"><h2 class="ktieu">Máy chủ · trực tiếp</h2></div><span class="phu-nho" id="mcLuc">từ máy chủ game</span></div>
    <div class="mc-canh" id="mcCanhBao" hidden></div>
    <div class="mc-dai" id="mcDai"></div>
    <div class="mc-may" id="mcMay"></div>
    <div class="mc-ngay" id="mcNgay"></div>
    <div class="td-cuon"><table class="td-bang" id="mcPhong"></table></div>
    <p class="loi-o" id="loi-maychu" hidden></p>
  </section>

  <!-- TĂNG TRƯỞNG (28.11.2026): /api/tangtruong — 28 ngày trọn tới hôm qua, KHÔNG theo bộ chọn khoảng. Mục tiêu 100 online. -->
  <section class="thach the" id="tangTruong" data-tab="tangtruong">
    <div class="the-dau"><div class="tieu"><h2 class="ktieu">Mục tiêu · 100 người online thường xuyên</h2></div><span class="phu-nho" id="ttLuc">28 ngày gần nhất · GA</span></div>
    <div class="tt-dich" id="ttDich"><span class="sk" style="height:54px"></span></div>
    <div class="luoi-kpi" id="ttKpi"></div>
    <div class="the-phu"><span class="mo">Online trung bình mỗi ngày (cột) · vạch = giờ đông nhất trong ngày</span></div>
    <div class="cuon"><div class="cot-vung" id="ttCot"></div></div>
    <p class="loi-o" id="loi-tangtruong" hidden></p>
  </section>
  <section class="thach the" data-tab="tangtruong">
    <div class="the-dau"><div class="tieu"><h2 class="ktieu">Giữ chân · người mới theo tuần còn quay lại</h2></div><span class="phu-nho">ngày 1 · ngày 7 sau lần đầu</span></div>
    <div class="td-cuon"><table class="td-bang" id="ttGiuChan"></table></div>
    <p class="ghi-o">Nhóm trên cùng chưa đủ 7 ngày nên chỉ có ngày 1. Web lẫn máy quét và kiểm thử tự động. Android lẫn máy thử của Google Play (mỗi bản đẩy lên store là một loạt máy tự mở app) và mỗi tuần chỉ vài người thật — số % Android chưa đủ tin; iOS là số sạch nhất.</p>
  </section>
  <section class="luoi-ds tt-luoi" data-tab="tangtruong">
    <div class="thach the"><div class="tieu"><h2 class="ktieu">Kích hoạt · người mới chơi xong ván đầu</h2></div><div class="td-cuon"><table class="td-bang" id="ttKichHoat"></table></div></div>
    <div class="thach the"><div class="tieu"><h2 class="ktieu">Người mới đến từ đâu</h2></div><div class="td-cuon"><table class="td-bang" id="ttNguon"></table></div><p class="ghi-o">0 phút chơi = gần như chắc là máy quét, không phải người.</p></div>
    <div class="thach the"><div class="tieu"><h2 class="ktieu">Nước · theo giờ chơi</h2></div><div class="td-cuon"><table class="td-bang" id="ttNuoc"></table></div></div>
    <div class="thach the"><div class="tieu"><h2 class="ktieu">Lan truyền · 28 ngày</h2></div><div class="td-cuon"><table class="td-bang" id="ttLan"></table></div></div>
  </section>

  <!-- TỪNG Ô TẢI RIÊNG (19.11.2026): mỗi khung mang data-phan = tên ô ở /api/o/<phan>; chỉ tải khi cuộn tới gần
       (IntersectionObserver), tối đa 3 ô cùng lúc. Khung xương lần đầu: vẽ đè bằng số thật. -->
  <div class="o-kpi" data-phan="kpi" data-tab="tong">
    <p class="ttl-nhom">Kỳ này · so với kỳ trước</p>
    <section class="luoi-kpi" id="kpi">
      <div class="thach kpi"><span class="sk" style="width:60%;height:16px"></span><span class="sk" style="width:45%;height:36px"></span><span class="sk" style="width:70%;height:12px"></span></div>
      <div class="thach kpi"><span class="sk" style="width:60%;height:16px"></span><span class="sk" style="width:45%;height:36px"></span><span class="sk" style="width:70%;height:12px"></span></div>
      <div class="thach kpi"><span class="sk" style="width:60%;height:16px"></span><span class="sk" style="width:45%;height:36px"></span><span class="sk" style="width:70%;height:12px"></span></div>
      <div class="thach kpi"><span class="sk" style="width:60%;height:16px"></span><span class="sk" style="width:45%;height:36px"></span><span class="sk" style="width:70%;height:12px"></span></div>
    </section>
    <p class="loi-o" id="loi-kpi" hidden></p>
  </div>

  <section class="hang" data-tab="tong">
    <div class="thach the bieu-do" data-phan="chuoi">
      <div class="the-dau">
        <div class="tieu"><h2 class="ktieu" id="tieuChuoi">Người chơi</h2></div>
        <div class="chips nho" id="hat" role="group" aria-label="Mỗi cột ứng với"></div>
      </div>
      <div class="the-phu"><span id="ghiChuoi" class="mo"></span><span class="chu-giai" id="chuGiai"></span></div>
      <div class="cuon"><div class="cot-vung" id="chuoi"><span class="sk" style="flex:1;height:190px;align-self:flex-end"></span></div></div>
      <p class="loi-o" id="loi-chuoi" hidden></p>
    </div>
    <div class="thach the nen-tang" data-phan="nen_tang">
      <div class="tieu"><h2 class="ktieu">Nền tảng</h2></div>
      <div class="thanh" id="thanhNt"></div>
      <div id="nenTang"><span class="sk" style="height:40px"></span><span class="sk" style="height:40px"></span><span class="sk" style="height:40px"></span></div>
      <p class="loi-o" id="loi-nen_tang" hidden></p>
    </div>
  </section>

  <section class="thach the" data-phan="heat" data-tab="nguoi">
    <div class="the-dau">
      <div class="tieu"><h2 class="ktieu">Giờ cao điểm · ván bắt đầu theo giờ trong tuần</h2></div>
      <span class="mo" id="ghiHeat"></span>
    </div>
    <div class="cuon"><div id="heat" class="heat"><span class="sk" style="height:200px"></span></div></div>
    <p class="loi-o" id="loi-heat" hidden></p>
  </section>

  <!-- Các ô danh sách: JS dựng từ bảng DS (mỗi ô một data-phan) -->
  <section class="luoi-ds" id="danhSach"></section>

  <!-- THI ĐẤU (23.11.2026): số từ MÁY CHỦ GAME (/api/thidau), không qua GA và không theo bộ chọn khoảng ở trên -->
  <section class="thach the" id="thiDau" data-tab="online">
    <div class="the-dau"><div class="tieu"><h2 class="ktieu">Thi đấu · 30 ngày gần nhất</h2></div><span class="phu-nho" id="tdLuc">từ máy chủ game</span></div>
    <div class="luoi-kpi" id="tdKpi"></div>
    <div class="td-cuon"><table class="td-bang" id="tdBang"></table></div>
    <div class="td-cuon"><table class="td-bang" id="tdNhom"></table></div>
    <p class="loi-o" id="loi-thidau" hidden></p>
  </section>

  <footer class="chan">
    <span>Số liệu từ Google Analytics · chỉ hỏi khi mở trang · số trong ngày trễ vài giờ. Riêng ô Thi đấu lấy từ thống kê ẩn danh của máy chủ game.</span>
    <span>Số GA là ước lượng: người chặn quảng cáo hoặc từ chối đồng ý thu thập không được đếm.</span>
  </footer>
</div>
</body>
</html>`;

export const CSS = String.raw`
:root{--nen:#0c0e1c;--o:#171a30;--o2:#10132a;--vien:#2a2f52;--day:#070812;--chu:#e6e8f8;--mo:#9aa0c8;--vua:#c9cdea;--tim:#6a5cff;--tim2:#8b7dff;
--web:#67e8f9;--ios:#8b7dff;--android:#c026d3;--tat_ca:#a99fff}
*{box-sizing:border-box}
[hidden]{display:none!important}   /* .tuy-chon{display:flex} đè thuộc tính hidden */
/* ĐANG TẢI: thanh chạy trên đầu + ô mờ nhịp + vòng xoay ở nút vừa bấm + khung xương lần đầu */
.thanh-tai{position:fixed;top:0;left:0;right:0;height:4px;overflow:hidden;z-index:50;opacity:0;transition:opacity .25s;pointer-events:none}
body.dang-tai .thanh-tai{opacity:1}
.thanh-tai::before{content:'';position:absolute;top:0;bottom:0;left:0;width:40%;border-radius:999px;background:linear-gradient(90deg,transparent,#8b7dff,#67e8f9,transparent);animation:tt-chay 1.1s ease-in-out infinite}
@keyframes tt-chay{from{transform:translateX(-100%)}to{transform:translateX(260%)}}
/* ô đang chờ/đang tải số mới thì mờ nhịp — chỉ ô đó, không cả trang */
.cho-o{animation:tt-tho 1.2s ease-in-out infinite}
@keyframes tt-tho{50%{opacity:.5}}
.sk{display:block;border-radius:10px;background:linear-gradient(90deg,#1c2040 25%,#2a3060 50%,#1c2040 75%);background-size:200% 100%;animation:tt-lap 1.3s linear infinite}
@keyframes tt-lap{to{background-position:-200% 0}}
.song-so .sk{display:inline-block}
#nenTang .sk+.sk{margin-top:10px}
/* vòng xoay ĐÈ lên chữ (chữ trong suốt) — nút giữ nguyên bề ngang, không đẩy hàng nút xuống dòng */
.chip.quay{position:relative;color:transparent!important}
.chip.quay::after{content:'';position:absolute;inset:0;margin:auto;width:16px;height:16px;border-radius:999px;border:2px solid #fff;border-right-color:transparent;animation:tt-xoay .7s linear infinite}
@keyframes tt-xoay{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.thanh-tai::before,.sk,.chip.quay::after,.cho-o{animation-duration:3s}}
html{color-scheme:dark}
/* GỌN (28.11.2026) */
.ttl-nhom{margin:0 2px;font:800 11.5px Nunito,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mo)}
.kpi-so{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px}
.kpi-so .doi{font-size:14px;font-weight:800}
.kpi-ghi{font-size:12px;color:var(--mo);font-weight:700}
.gn{font:800 10px Nunito,sans-serif;padding:1px 6px;border-radius:6px;background:rgba(251,191,36,.16);color:#fcd34d;vertical-align:1px}
.nut-ky,.nen-ky,.tam-tieu{display:none}
.mc-dai{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px;border-radius:16px;background:var(--o2)}
.mc-dai div{text-align:center}.mc-dai b{display:block;font:800 26px/1.1 'Baloo 2',sans-serif;color:var(--chu)}.mc-dai span{font-size:12px;font-weight:800;color:var(--mo)}
.mc-may{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.may{padding:14px 16px;display:flex;flex-direction:column;gap:6px}
.may-dau{display:flex;align-items:baseline;gap:10px;margin-bottom:2px}.may-dau b{font:800 19px 'Baloo 2',sans-serif;color:var(--chu)}.may-dau span{font-size:12.5px;color:var(--mo);font-weight:700}
.may-dau .tt{margin-left:auto;font-size:11px;font-weight:800;padding:2px 9px;border-radius:99px}
.tt.muc-tot{background:rgba(74,222,128,.14);color:#86efac}.tt.muc-vang{background:rgba(251,191,36,.16);color:#fcd34d}.tt.muc-do{background:rgba(239,68,68,.22);color:#fecaca}
.cs{display:grid;grid-template-columns:64px 1fr 44px;align-items:center;gap:8px;font-size:12.5px}
.cs span{color:var(--mo);font-weight:800}.cs em{font-style:normal;text-align:right;font-weight:800;font-variant-numeric:tabular-nums;color:var(--vua)}
.cs .ray{height:8px;border-radius:6px;background:var(--o2);overflow:hidden}.cs .ray i{display:block;height:100%;border-radius:6px;background:var(--tim2)}
.cs .ray i.muc-vang{background:#f59e0b}.cs .ray i.muc-do{background:#ef4444}.cs em.muc-vang{color:#fcd34d}.cs em.muc-do{color:#fca5a5}
.may-ghi{margin:4px 0 0;font-size:11.5px;color:var(--mo);font-weight:700}
.mc-ngay{display:flex;flex-wrap:wrap;gap:8px 24px;padding:2px 4px}
.mc-ngay div{display:flex;align-items:baseline;gap:6px;font-size:12.5px;color:var(--mo);font-weight:700}.mc-ngay b{font:800 17px 'Baloo 2',sans-serif;color:var(--chu)}
/* BẢNG MÁY CHỦ (28.11.2026): ≥ 80% vàng, ≥ 95% đỏ */
.td-bang td.muc-vang{color:#fcd34d;background:rgba(251,191,36,.12);font-weight:800}
.td-bang td.muc-do{color:#fecaca;background:rgba(239,68,68,.28);font-weight:800}
.mc-canh{display:flex;flex-wrap:wrap;gap:8px}
.mc-canh .canh{padding:6px 12px;border-radius:999px;font-size:13px;font-weight:800}
.mc-canh .muc-vang{background:rgba(251,191,36,.14);color:#fcd34d}
.mc-canh .muc-do{background:rgba(239,68,68,.22);color:#fecaca}
/* TĂNG TRƯỞNG (28.11.2026) */
.tt-dich{display:flex;flex-direction:column;gap:8px;padding:14px 16px;border-radius:16px;background:var(--o2)}
.tt-dich .hang-so{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px 12px}
.tt-dich .hang-so b{font:800 40px/1 'Baloo 2',sans-serif;color:var(--chu)}
.tt-dich .hang-so span{font-size:14px;font-weight:800;color:var(--mo)}
.tt-dich .ray{position:relative;height:14px;border-radius:999px;background:var(--o);border:2px solid var(--vien);overflow:hidden}
.tt-dich .ray i{display:block;height:100%;min-width:6px;border-radius:999px;background:linear-gradient(90deg,var(--tim),#67e8f9)}
.tt-dich p{margin:0;font-size:12.5px;font-weight:700;color:var(--mo)}
.tt-luoi{grid-template-columns:repeat(auto-fit,minmax(min(100%,430px),1fr))}
@media (min-width:900px){#ttKpi{grid-template-columns:repeat(3,minmax(0,1fr))}}
#ttCot .cot .khoi{background:var(--tim2)}
#ttCot .cot .dinh{position:absolute;left:10%;right:10%;height:3px;border-radius:2px;background:#fcd34d}
.td-bang td.tot{color:#86efac;font-weight:800}.td-bang td.kem{color:#fca5a5;font-weight:800}
.td-bang th.nhom{text-align:center;border-left:1px solid rgba(255,255,255,.08)}
.td-bang td.vach,.td-bang th.vach{border-left:1px solid rgba(255,255,255,.08)}
/* CHIA TAB (28.11.2026) */
.ngoai-tab{display:none!important}
.tabs{display:flex;gap:6px;border-bottom:2px solid var(--vien);margin-top:-4px;overflow-x:auto;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab{appearance:none;flex:none;background:none;border:2px solid transparent;border-bottom:0;display:inline-flex;align-items:center;gap:8px;padding:10px 16px 12px;border-radius:14px 14px 0 0;color:var(--mo);font:800 14.5px Nunito,sans-serif;cursor:pointer;position:relative;top:2px;min-height:46px}
.tab svg{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.tab[aria-selected="true"]{color:var(--chu);background:var(--o);border-color:var(--vien);border-bottom:2px solid var(--o)}
.tab:focus-visible{outline:3px solid #fcd34d;outline-offset:-3px}
@media (hover:hover){.tab[aria-selected="false"]:hover{color:var(--chu)}}
.so-tab{font:800 11px Nunito,sans-serif;padding:1px 7px;border-radius:99px;background:rgba(74,222,128,.15);color:#86efac}
.song-nho{display:none}
body{margin:0;background:var(--nen);color:var(--chu);font:16px/1.5 Nunito,system-ui,sans-serif}
.khung{max-width:1320px;margin:0 auto;padding:24px 16px 48px;display:flex;flex-direction:column;gap:20px}
h1{margin:0;font:800 28px/1.1 'Baloo 2',sans-serif;color:#fff}
.phu{margin:2px 0 0;font-size:13px;color:var(--mo)}
.mo{color:var(--mo);font-size:13px;font-weight:700}
.dau{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px}
.dau .song{margin-left:auto}   /* cạnh tiêu đề, dạt phải; thiếu chỗ thì xuống dòng gọn */
.ten{display:flex;align-items:center;gap:14px}
.logo{width:52px;height:52px;flex:none;display:block;border-radius:16px;overflow:hidden;box-shadow:0 5px 0 #3b2fb0;transition:transform .12s ease}
.logo img{width:100%;height:100%;display:block}
.logo:hover{transform:translateY(-2px)}
.logo:active{transform:translateY(2px);box-shadow:0 2px 0 #3b2fb0}
.logo:focus-visible{outline:3px solid var(--tim2);outline-offset:3px}
.dieu-khien,.chips{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.chips.nho{gap:8px}
.thach{background:var(--o);border:2px solid var(--vien);border-radius:18px;box-shadow:0 5px 0 var(--day)}
.chip{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px;border-radius:999px;border:2px solid var(--vien);background:var(--o);box-shadow:0 4px 0 var(--day);color:var(--vua);font:700 14px Nunito,sans-serif;cursor:pointer;text-decoration:none}
.chips.nho .chip{padding:0 12px;font-size:13px}
.chip.chon{background:var(--tim);border-color:var(--tim2);color:#fff;box-shadow:0 2px 0 #3b2fb0;transform:translateY(2px)}
.chip:active{transform:translateY(3px);box-shadow:0 1px 0 var(--day)}
.chip:focus-visible,.nguoi:focus-visible{outline:3px solid #fcd34d;outline-offset:2px}
@media (hover:hover){.chip:not(.chon):hover{border-color:var(--tim2);color:#fff}}
.nguoi{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border-radius:999px;background:rgba(74,222,128,.1);color:#86efac;font-weight:700;font-size:13px;text-decoration:none}
.tuy-chon{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px;padding:16px 18px}
.tuy-chon label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:700;color:var(--mo)}
.tuy-chon input{min-height:44px;padding:0 12px;border-radius:12px;border:2px solid var(--vien);background:var(--o2);color:var(--chu);font:600 15px Nunito,sans-serif}
.bao{padding:14px 16px;border-radius:14px;background:rgba(251,191,36,.1);color:#fcd34d;font-size:14px;font-weight:600}
.bao code{background:rgba(0,0,0,.3);padding:1px 6px;border-radius:6px}
.bao.do{background:rgba(252,165,165,.12);color:#fca5a5}
.nguon{display:inline-block;padding:2px 8px;border-radius:999px;font:800 10.5px Nunito,sans-serif;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.n-ga{background:rgba(251,191,36,.16);color:#fcd34d}
.n-live{background:rgba(74,222,128,.16);color:#86efac}
.ktieu{margin:0;font:700 13px Nunito,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--mo)}
.td-cuon{overflow-x:auto}
.td-bang{border-collapse:collapse;width:100%;font-size:13.5px;font-variant-numeric:tabular-nums}
.td-bang th,.td-bang td{padding:7px 10px;text-align:right;white-space:nowrap;border-bottom:1px solid rgba(255,255,255,.08)}
.td-bang th{font-weight:700;color:var(--mo);font-size:12px}
.td-bang th:first-child,.td-bang td:first-child{text-align:left}
#thiDau .kpi b{font-size:30px}
.song{padding:8px 14px;display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;border-radius:18px;border:2px solid #23573a;background:rgba(74,222,128,.06)}
.phu-nho{font-size:12px;color:var(--mo);font-weight:600}
.ky-chon{margin:0;font:700 13px Nunito,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--mo)}
.ky-chon b{color:#fff}
.kpi-dau{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.kpi-dau .nhan{min-width:0}
.song-tieu{display:flex;align-items:center;gap:10px}
.song-tieu .phu-nho{display:block;font-size:11.5px;line-height:1.2}
.song-tieu .ktieu{line-height:1.2}
.cham{width:12px;height:12px;border-radius:999px;background:#4ade80;box-shadow:0 0 0 5px rgba(74,222,128,.18)}
.song-so{display:flex;flex-wrap:wrap;gap:28px}
.song-so b,.kpi b{font:800 26px/1 'Baloo 2',sans-serif;color:#fff}
.song-so span.k{font-size:14px;color:var(--mo);font-weight:700;margin-left:8px}
.luoi-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
/* 8 ô: 4 + 4 cho cân (auto-fit ra 6 + 2 trên màn rộng) */
@media (min-width:900px){.luoi-kpi{grid-template-columns:repeat(4,minmax(0,1fr))}}
.kpi{padding:18px;display:flex;flex-direction:column;gap:8px}
.kpi .nhan{font-size:14px;font-weight:700;color:var(--vua)}
.kpi b{font-size:36px}
.kpi .doi{font-size:13px;font-weight:700;color:var(--vua)}
.kpi .doi.len{color:#86efac}.kpi .doi.xuong{color:#fca5a5}
.hang{display:flex;flex-wrap:wrap;gap:16px}
.the{padding:20px;display:flex;flex-direction:column;gap:14px;min-width:0}
.bieu-do{flex:999 1 560px}
.nen-tang{flex:1 1 300px}
.the-dau{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px}
.the-phu{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px}
.tieu{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.chu-giai{display:flex;gap:14px;font-size:13px;font-weight:700;color:var(--vua)}
.chu-giai i,.nt-dong i{display:inline-block;width:12px;height:12px;border-radius:4px;margin-right:6px;vertical-align:-1px}
.chu-giai span,.nt-dong > span{display:inline-flex;align-items:center}
.icon-nt{width:18px;height:18px;flex:none;margin-right:6px}
.chu-giai .icon-nt{width:15px;height:15px;margin-right:5px}
.co{font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;margin-right:6px;font-size:1.15em;line-height:1}
.cuon{overflow-x:auto}
.cot-vung{display:flex;align-items:flex-end;gap:3px;height:250px;border-bottom:2px solid var(--vien);padding-top:20px}
.cot{flex:1 0 6px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;position:relative}
.cot .so{font-size:11px;font-weight:800;color:var(--mo);margin-bottom:4px}
.cot .khoi{width:100%;max-width:34px;display:flex;flex-direction:column-reverse;border-radius:6px 6px 0 0;overflow:hidden}
.cot .nhan{position:absolute;bottom:-22px;font-size:11px;color:var(--mo);white-space:nowrap}
.cot.moc .nhan{color:var(--vua);font-weight:800}
.cot-vung{margin-bottom:26px}
.thanh{display:flex;height:20px;border-radius:999px;overflow:hidden;background:var(--o2)}
.nt-dong{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #222743;font-weight:700}
.nt-dong b{font:800 18px 'Baloo 2',sans-serif}
.nt-dong small{font:700 13px Nunito,sans-serif;color:var(--mo);margin-left:6px}
.heat{min-width:760px;display:flex;flex-direction:column;gap:4px}
.heat .h{display:flex;gap:4px;align-items:center}
.heat .h > span:first-child{width:48px;flex:none;font-size:12.5px;font-weight:700;color:var(--vua)}
.heat .o{flex:1;height:26px;border-radius:6px}
.heat .gio span{flex:1;text-align:center;font-size:11px;color:var(--mo)}
.luoi-ds{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.ds-dong{display:flex;flex-direction:column;gap:4px}
.ds-dong .tren{display:flex;justify-content:space-between;font-size:14px;font-weight:700;gap:8px}
.ds-dong .tren span:last-child{color:var(--vua)}
.ds-dong .ray{height:8px;border-radius:999px;background:var(--o2);overflow:hidden}
.ds-dong .ray div{height:100%;border-radius:999px}
.o-kpi{display:flex;flex-direction:column;gap:12px}
.ds-than{display:flex;flex-direction:column;gap:14px}
.ds-dong .ngan-xep{display:block;margin-top:2px;font:600 11.5px ui-monospace,Menlo,Consolas,monospace;color:var(--mo);word-break:break-all}
.ghi-o{margin:0;font-size:12.5px;color:var(--mo);font-weight:600}
/* trạng thái tải của từng ô: lỗi + nút Thử lại, hoặc đang hiện số cũ vì GA bận */
.o-trang{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0;padding:10px 12px;border-radius:12px;font-size:13px;font-weight:600}
.o-trang.loi{background:rgba(252,165,165,.1);color:#fca5a5}
.o-trang.cu{background:rgba(251,191,36,.1);color:#fcd34d}
.o-trang .chip{min-height:36px;padding:0 14px;font-size:13px}
.loi-o{margin:0;padding:10px 12px;border-radius:12px;background:rgba(252,165,165,.1);color:#fca5a5;font-size:13px;font-weight:600}
.chan{display:flex;flex-wrap:wrap;gap:10px 20px;font-size:13px;color:var(--mo)}
.song-nuoc{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.nuoc{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:var(--o2);font-size:13px;font-weight:700;color:var(--vua)}
.nuoc b{font:800 15px 'Baloo 2',sans-serif;color:#fff}
/* ĐIỆN THOẠI (17.11.2026, chủ dự án: "trên mobile hơi xấu"): khoảng thời gian thành dải vuốt ngang
   một dòng, ô số 2 cột gọn, số trên chữ ở dải 30 phút. */
@media (max-width:700px){
  .khung{padding:14px 12px calc(96px + env(safe-area-inset-bottom,0px));gap:14px}
  /* thanh tab cố định ở đáy */
  .tabs{position:fixed;left:0;right:0;bottom:0;z-index:40;margin:0;border:0;border-top:2px solid var(--vien);background:var(--o);display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:2px;padding:6px max(4px,env(safe-area-inset-left,0px)) calc(8px + env(safe-area-inset-bottom,0px)) max(4px,env(safe-area-inset-right,0px));box-shadow:0 -6px 18px rgba(0,0,0,.25)}
  .tab{flex-direction:column;justify-content:center;gap:3px;padding:6px 0;min-height:54px;font-size:9.5px;white-space:nowrap;border:0;border-radius:12px;top:0}
  .tab[aria-selected="true"]{background:rgba(106,92,255,.16);color:var(--tim2);border:0}
  .tab .so-tab{position:absolute;top:3px;left:calc(50% + 6px);font-size:9.5px;padding:0 5px}
  /* đầu trang một hàng: "Ngay lúc này" đầy đủ chỉ ở tab Tổng quan, tab khác còn viên thuốc nhỏ */
  .dau{flex-wrap:nowrap}
  .song-nho{display:inline-flex;align-items:center;gap:7px;margin-left:auto;padding:5px 11px;border-radius:999px;background:rgba(74,222,128,.12);color:#86efac;font-weight:800;font-size:12.5px;white-space:nowrap}
  .song-nho .cham{width:8px;height:8px;box-shadow:0 0 0 3px rgba(74,222,128,.2)}
  .song-nho b{font:800 15px 'Baloo 2',sans-serif}
  .dau .song{display:none}
  /* đầu trang một hàng: logo nhỏ · "Quản trị" · nút khoảng (+ viên trực tiếp ở tab khác Tổng quan) */
  .logo{width:32px;height:32px;border-radius:10px;box-shadow:0 3px 0 #3b2fb0}
  h1{font-size:18px}
  .ten{gap:8px}
  .h1-dai{display:none}
  .nut-ky{display:inline-flex;align-items:center;gap:4px;margin-left:8px;min-height:36px;padding:0 12px;border-radius:999px;border:2px solid var(--tim2);background:var(--tim);color:#fff;font:800 13px Nunito,sans-serif;box-shadow:0 3px 0 #3b2fb0;white-space:nowrap;flex:none}
  .song-nho{font-size:11.5px;padding:4px 9px}
  .song-nho .gn{display:none}
  /* Tổng quan: dải trực tiếp một hàng — số + cờ (tên nước ẩn, giữ trong title) */
  body[data-tab="tong"] .dau{flex-wrap:wrap}
  body[data-tab="tong"] .song-nho{display:none}
  body[data-tab="tong"] .nut-ky{margin-left:auto}
  body[data-tab="tong"] .dau .song{display:flex;flex-wrap:nowrap;align-items:center;gap:10px;padding:8px 12px;border-radius:14px;border-width:1.5px}
  .song-tieu .ktieu,.song-tieu .phu-nho{display:none}
  .song-tieu .cham{width:9px;height:9px;box-shadow:0 0 0 4px rgba(74,222,128,.2)}
  .song-so{flex-wrap:nowrap;gap:12px;align-items:baseline;width:auto!important}
  .song-so > div{display:flex;align-items:baseline;gap:4px;white-space:nowrap}
  .song-so b{font-size:18px!important}
  .song-so span.k{display:inline!important;margin:0!important;font-size:11.5px!important}
  .song-so > div:nth-child(2) span.k{font-size:0!important}.song-so > div:nth-child(2) span.k::after{content:'ván';font-size:11.5px}
  .song-nuoc{width:auto!important;margin-left:auto;flex-wrap:nowrap;gap:6px;overflow:hidden}
  .nuoc{padding:0;background:none;gap:3px;font-size:12px}.nuoc .ten-nuoc{display:none}.nuoc b{font-size:13px}
  .nuoc .co{margin-right:0}
  /* tấm chọn khoảng trượt lên từ đáy */
  .ky-chon{display:none}
  .dieu-khien{display:none}
  body.mo-ky .nen-ky{display:block;position:fixed;inset:0;z-index:44;background:rgba(0,0,0,.45)}
  body.mo-ky .dieu-khien{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;position:fixed;left:0;right:0;bottom:0;z-index:45;overflow:visible;padding:16px max(14px,env(safe-area-inset-left,0px)) calc(20px + env(safe-area-inset-bottom,0px)) max(14px,env(safe-area-inset-right,0px));background:var(--o);border-top:2px solid var(--vien);border-radius:22px 22px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.4)}
  body.mo-ky .tam-tieu{display:block;grid-column:1/-1;margin:0 0 2px;font:800 16px 'Baloo 2',sans-serif;color:var(--chu)}
  body.mo-ky #khoang{display:contents}
  body.mo-ky .dieu-khien .chip{justify-content:center;width:100%;padding:0 6px}
  body.mo-ky .nguoi{justify-content:center}
  body.mo-ky .tuy-chon{grid-column:1/-1}
  /* Online: thẻ máy + dải số gọn */
  .mc-dai{padding:10px 6px;gap:4px}.mc-dai b{font-size:21px}.mc-dai span{font-size:10.5px}
  .may{padding:11px 12px;gap:5px}
  .mc-ngay{gap:6px 16px}
  /* hàng khoảng thời gian + nút: một dải vuốt ngang */
  .dieu-khien{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:6px}
  .dieu-khien::-webkit-scrollbar{display:none}
  .dieu-khien > *{flex:none}
  #khoang{width:auto!important;overflow:visible!important;padding:2px 0!important;margin:0!important}
  .ten{gap:10px}
  .logo{width:40px;height:40px;border-radius:12px;box-shadow:0 4px 0 #3b2fb0}
  h1{font-size:20px}
  .phu{font-size:12px}
  .dau{gap:12px}
  .dieu-khien{width:100%;gap:8px}
  #khoang{flex-wrap:nowrap;width:100%;overflow-x:auto;gap:8px;padding:2px 2px 8px;margin:0 -2px;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}
  #khoang::-webkit-scrollbar{display:none}
  #khoang .chip{flex:none;scroll-snap-align:center}
  .chip{padding:0 14px;font-size:13.5px}
  .nguoi{margin-left:auto;padding:0 12px}
  .song{width:100%;padding:12px 14px;gap:8px 16px}
  .dau .phu{display:none}
  .song-so{width:100%;gap:12px 22px}
  .song-so b{font-size:26px}
  .song-so span.k{display:block;margin:2px 0 0;font-size:12px}
  .song-nuoc{width:100%}
  .luoi-kpi{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .kpi{padding:12px 14px;gap:4px;border-radius:16px}
  .kpi .nguon{display:none}
  .kpi .nhan{font-size:12.5px;line-height:1.3}
  .kpi b{font-size:26px}
  .kpi .doi{font-size:12px;line-height:1.3}
  .kpi-ghi{font-size:11px}
  .kpi b{font-size:22px!important}
  .ttl-nhom{font-size:10.5px}
  .the{padding:16px;gap:12px}
  .tt-dich .hang-so b{font-size:32px}
  .luoi-ds{gap:12px}
}
/* BẢN SÁNG (28.11.2026, mockup duyệt): theo cài đặt sáng/tối của máy. Bản tối giữ nguyên như cũ. */
@media (prefers-color-scheme:light){
  :root{--nen:#f4f3fb;--o:#fff;--o2:#efedfa;--vien:#dcd8f2;--day:#d3cdec;--chu:#1d1f3a;--mo:#5d6390;--vua:#3a3f66;--tim2:#5847f0}
  html{color-scheme:light}
  h1,.song-so b,.kpi b,.ky-chon b,.nuoc b{color:var(--chu)}
  @media (hover:hover){.chip:not(.chon):hover{color:var(--chu)}}
  .sk{background:linear-gradient(90deg,#e9e6f7 25%,#f6f4fd 50%,#e9e6f7 75%);background-size:200% 100%}
  .nt-dong,.td-bang th,.td-bang td{border-bottom-color:#e6e3f5}
  .song{border-color:#bfe7cd;background:rgba(22,163,74,.06)}
  .kpi .doi.len,.nguoi,.n-live,.so-tab,.song-nho{color:#15803d}
  .kpi .doi.xuong,.o-trang.loi,.loi-o,.bao.do{color:#b91c1c}
  .o-trang.cu,.bao,.n-ga{color:#a16207}
  .chip.quay::after{border-color:var(--tim);border-right-color:transparent}
  .tab:focus-visible,.chip:focus-visible,.nguoi:focus-visible{outline-color:#b45309}
  .ray div,.cot .khoi,.thanh > *,.heat .o,.chu-giai i,.nt-dong i{filter:saturate(1.35) brightness(.85)}
  .tabs{box-shadow:none}
  .td-bang td.muc-vang,.mc-canh .muc-vang,.tt.muc-vang{color:#92400e;background:#fef3c7}
  .tt.muc-tot{color:#15803d;background:#dcfce7}.tt.muc-do{color:#991b1b;background:#fee2e2}
  .cs em.muc-vang{color:#b45309}.cs em.muc-do{color:#b91c1c}
  .gn{background:#fef3c7;color:#92400e}
  .td-bang td.tot{color:#15803d}.td-bang td.kem{color:#b91c1c}
  #ttCot .cot .dinh{background:#b45309}
  .td-bang th.nhom,.td-bang td.vach,.td-bang th.vach{border-left-color:#e6e3f5}
  .td-bang td.muc-do,.mc-canh .muc-do{color:#991b1b;background:#fee2e2}
}
`;

export const JS = String.raw`
(function () {
  var KHOANG = [['30m','30 phút'],['6h','6 giờ'],['24h','24 giờ'],['today','Hôm nay'],['yday','Hôm qua'],['7','7 ngày'],['30','30 ngày'],['90','90 ngày'],['all','Từ khi công khai']];
  var HAT = { '5m': '5 phút', '1h': 'Giờ', '1d': 'Ngày', '1w': 'Tuần' };
  var MAU = { web: '#67e8f9', ios: '#8b7dff', android: '#c026d3', tat_ca: '#a99fff' };
  var CHE_DO = { choi_nhanh: 'Chơi nhanh', chien_dich: 'Chiến dịch', dau_may: 'Đấu máy', online: 'Online', nhieu_nguoi: 'Nhiều người (một máy)', nhieu_nguoi_may: 'Nhiều người + máy', tim_the: 'Tìm Thẻ · một mình', tim_the_online: 'Tìm Thẻ · online' };
  // Tên dễ đọc của chuc_nang (app: moChucNang). Thêm tính năng mới ở app thì thêm một dòng ở đây; thiếu thì hiện tên thô.
  var TINH_NANG = {
    choi_nhanh: 'Chơi nhanh', dau_may: 'Đấu máy', chien_dich: 'Chiến dịch', chien_dich_choi_tiep: 'Chiến dịch · chơi tiếp',
    choi_online: 'Mở màn Online', mua_the: 'Mùa thẻ', luat_choi: 'Luật chơi', tai_khoan: 'Tài khoản', danh_hieu: 'Danh hiệu',
    cai_app: 'Hộp cài app', chinh_phuc: 'Đạt danh hiệu', pha_ky_luc: 'Phá kỷ lục', luu_chia_se_anh: 'Khoe tỷ số (mở hộp)',
    xep_hang: 'Bảng xếp hạng', xep_hang_tab: 'Bảng xếp hạng · đổi tab', xep_hang_thach: 'Bảng xếp hạng · thách đấu',
    tri_nho: 'Chỉ số trí nhớ', tri_nho_luyen: 'Chỉ số trí nhớ · Luyện ngay', tri_nho_14_ngay: 'Chỉ số trí nhớ · tab 14 ngày',
    tri_nho_giai_thich: 'Chỉ số trí nhớ · bấm dấu ?', bxh_an: 'Xếp hạng · ẩn/hiện tôi (Cài đặt)', online_sang_xem: 'Online · bị bot chuyển sang xem', van_the_may: 'Ván cộng vào tài khoản khi đã đăng xuất', hinh_nen_mo: 'Mở bảng chọn hình nền (debug)', premium_emoji_khoa: 'Emoji Premium · bấm khi chưa có', tri_nho_chia_se: 'Chỉ số trí nhớ · chia sẻ', tri_nho_choi_can: 'Chỉ số trí nhớ · bấm ván còn thiếu (chơi ngay)', tri_nho_can_them: 'Chỉ số trí nhớ · bấm dấu ? (cần thêm số liệu)', premium_tang_tu_dong: 'Premium · được tặng tự động khi mở app', premium_chi_nut_hien: 'Premium · hiện chỉ nút cài đặt (sau quà)', premium_chi_nut_xong: 'Premium · bấm Đã hiểu ở chỉ nút', premium_nghe_thu: 'Premium · nghe thử nhạc', chat_o: 'Chat · chuyển ô trong khung chat', hinh_nen: 'Hình nền hành tinh (debug)', premium: 'Bảng Premium (debug)', premium_chon_goi: 'Bảng Premium · đổi gói', premium_mua: 'Bảng Premium · bấm mua (thử)', premium_mua_xong: 'Bảng Premium · mua xong (thử)', premium_khoi_phuc: 'Bảng Premium · khôi phục', premium_nen_khoa: 'Bảng Premium · bấm hình nền đang khoá',
    ho_so: 'Hồ sơ (mở)', ho_so_luu: 'Hồ sơ (lưu)',
    online_tao_phong: 'Online · tạo phòng', online_vao_link_moi: 'Online · vào bằng link mời', online_vao_ma: 'Online · vào bằng mã',
    online_vao_phong_ds: 'Online · vào từ danh sách', online_moi_ban: 'Online · hộp mời bạn', online_chep_ma: 'Online · chép mã phòng',
    online_chep_loi_moi: 'Online · chép lời mời', online_moi_nguoi: 'Online · mời người đang online', loi_moi: 'Online · bấm lời mời',
    online_emoji: 'Online · thả emoji', online_noi_nhanh: 'Online · nói nhanh', online_xem: 'Online · vào xem trận',
    online_chon_the: 'Online · bỏ phiếu số thẻ', online_chon_kho: 'Online · bỏ phiếu độ khó (Tìm Thẻ)',
    tim_the: 'Tìm Thẻ · vào ván', kieu_choi: 'Setup · đổi kiểu chơi (Thường/Tìm Thẻ)', tim_the_chon: 'Tìm Thẻ · đổi số thẻ/độ khó',
    tim_the_choi_lai: 'Tìm Thẻ · chơi lại', tim_the_doi_cau_hinh: 'Tìm Thẻ · đổi cấu hình (hết ván)', phong_kieu_choi: 'Online · chủ phòng đổi kiểu chơi',
    tim_online_choi_lai: 'Tìm Thẻ online · chơi lại', tim_online_ve_phong: 'Tìm Thẻ online · về phòng chờ', tim_online_thoat: 'Tìm Thẻ online · thoát giữa ván', thi_dau_chot: 'Thi đấu · chốt số thẻ'
  };
  var CACH_VAO = { online_vao_link_moi: 'Link mời', online_vao_ma: 'Nhập mã', online_vao_phong_ds: 'Danh sách phòng' };
  var THEME = { animals: 'Động vật', ocean: 'Đại dương', nature: 'Thiên nhiên', seasons: 'Bốn mùa', food: 'Đồ ăn', letters: 'Chữ & hình', smileys: 'Mặt cười', games: 'Trò chơi', objects: 'Đồ vật', travel: 'Du lịch', festive: 'Lễ hội', flags: 'Cờ' };
  var THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  var PHEU = { lan_dau: 'Lần đầu vào game', vao_menu: 'Vào menu chọn', bat_dau_van: 'Bắt đầu ván', choi_xong: 'Chơi xong ván' };
  var CHU = { tu_roi: 'Tự rời', huy_phong: 'Chủ phòng tự huỷ', chu_huy: 'Bị chủ phòng huỷ', bi_kick: 'Bị mời ra', phong_dong: 'Phòng đã đóng',
    mat_mang: 'Mất mạng', khac: 'Khác', noi_lai_ok: 'Rớt rồi nối lại được', noi_lai_hong: 'Rớt, không nối lại được',
    mat_nhip: 'Mất nhịp tim', mat_nhip_noi_lai: 'Mất nhịp → nối lại', ack_cham: 'Nước đi xác nhận chậm', ack_hong: 'Nước đi không được xác nhận',
    ban_dung: 'Bàn đứng im', ban_dung_noi_lai: 'Bàn đứng im → nối lại', thuc_noi_lai: 'Mở lại app → nối lại', chap_chon: 'Chập chờn (nối được rồi đứt ngay)', choi: 'đang chơi', ket_qua: 'màn kết quả', cho: 'phòng chờ',
    ok: 'thành công', xong: 'xong', huy: 'huỷ', loi: 'lỗi', cu_qua: 'app quá cũ — cần lên store', moi: 'tài khoản mới',
    google: 'Google', apple: 'Apple', luu_anh: 'Lưu ảnh', anh: 'Chia sẻ ảnh', chu: 'Chia sẻ chữ', copy: 'Chép link',
    '(direct)': 'Vào thẳng', moi_ban: 'Link mời bạn', chia_se: 'Ảnh chia sẻ', 'play.google.com': 'Google Play', 'apps.apple.com': 'App Store' };
  var dich = function (x) { return String(x).split(' · ').map(function (p) { return CHU[p] || p; }).join(' · '); };
  var HEAT = ['#14183a', '#2c2a6e', '#4b3fb3', '#7a63f0', '#c4b5ff'];
  var tenNuoc = null;
  try { tenNuoc = new Intl.DisplayNames(['vi'], { type: 'region' }); } catch (e) { /* trình duyệt cũ */ }
  // Cờ = 2 ký tự "regional indicator" từ mã ISO (VN → 🇻🇳). Không phải mã 2 chữ cái thì 🌐.
  function co(code) {
    if (!/^[A-Za-z]{2}$/.test(code || '')) return '\uD83C\uDF10';
    return String.fromCodePoint.apply(null, code.toUpperCase().split('').map(function (c) { return 0x1F1E6 + c.charCodeAt(0) - 65; }));
  }
  function coNuoc(code) { var s = el('span', 'co', co(code)); s.setAttribute('aria-hidden', 'true'); return s; }
  // Icon nền tảng (SVG tự vẽ, tô theo màu nền tảng). id lạ → null, giữ ô màu cũ.
  var ICON_NT = {
    web: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9M12 3C9.4 5.6 8.2 8.6 8.2 12s1.2 6.4 3.8 9" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    ios: '<path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.9zM14 5.5c.7-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3z"/>',
    android: '<path fill="currentColor" d="M5 10.5h14V18a1.5 1.5 0 0 1-1.5 1.5H16V22h-2v-2.5h-4V22H8v-2.5H6.5A1.5 1.5 0 0 1 5 18zM2.5 10.5a1.25 1.25 0 0 1 2.5 0v5a1.25 1.25 0 0 1-2.5 0zm16.5 0a1.25 1.25 0 0 1 2.5 0v5a1.25 1.25 0 0 1-2.5 0zM5 9.5a7 7 0 0 1 3.6-6.1L7.3 1.5l.8-.5 1.4 2a7 7 0 0 1 5 0l1.4-2 .8.5-1.3 1.9A7 7 0 0 1 19 9.5zm4.3-3a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8zm5.4 0a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z"/>'
  };
  function iconNt(id) {
    if (!ICON_NT[id]) { var i = el('i'); i.style.background = MAU[id]; return i; }
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'icon-nt'); s.setAttribute('aria-hidden', 'true');
    s.style.color = MAU[id]; s.innerHTML = ICON_NT[id]; return s;
  }
  function tenNuocVi(code) { try { return tenNuoc && code && code !== '(not set)' ? tenNuoc.of(code) : (code || '?'); } catch (e) { return code; } }

  var nho = {}; try { nho = JSON.parse(localStorage.getItem('admin-loc') || '{}'); } catch (e) {}
  var tt = { khoang: nho.khoang || '24h', hat: '', tu: nho.tu || '', den: nho.den || '' };
  var $ = function (id) { return document.getElementById(id); };
  var so = function (n) { return n == null ? '—' : Number(n).toLocaleString('vi-VN'); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function luu() { try { localStorage.setItem('admin-loc', JSON.stringify({ khoang: tt.khoang, tu: tt.tu, den: tt.den })); } catch (e) {} }

  function veKhoang() {
    var c = $('khoang'); c.textContent = '';
    KHOANG.forEach(function (k) {
      var b = el('button', 'chip' + (tt.khoang === k[0] ? ' chon' : ''), k[1]);
      b.type = 'button'; b.setAttribute('aria-pressed', String(tt.khoang === k[0]));
      b.onclick = function () { tt.khoang = k[0]; tt.hat = ''; $('tuyChon').hidden = true; dongKy(); luu(); veKhoang(); tai(false); };
      c.appendChild(b);
    });
    $('nutTuyChon').classList.toggle('chon', tt.khoang === 'custom');
    var tk = KHOANG.find(function (k) { return k[0] === tt.khoang; });
    $('nutKyChu').textContent = tk ? tk[1] : 'Tuỳ chọn';
    var dc = c.querySelector('.chon');
    if (dc && c.scrollWidth > c.clientWidth) c.scrollLeft = dc.offsetLeft - (c.clientWidth - dc.offsetWidth) / 2;
  }

  $('nutTuyChon').onclick = function () {
    var f = $('tuyChon'); f.hidden = !f.hidden; this.setAttribute('aria-expanded', String(!f.hidden));
    if (!f.hidden) { $('tu').value = tt.tu; $('den').value = tt.den; $('tu').focus(); }
  };
  $('tuyChon').onsubmit = function (e) {
    e.preventDefault(); tt.khoang = 'custom'; tt.tu = $('tu').value; tt.den = $('den').value; tt.hat = ''; dongKy(); luu(); veKhoang(); tai(false);
  };
  /* Tấm chọn khoảng (điện thoại) */
  function moKy() { document.body.classList.add('mo-ky'); $('nenKy').hidden = false; $('nutKy').setAttribute('aria-expanded', 'true'); }
  function dongKy() { document.body.classList.remove('mo-ky'); $('nenKy').hidden = true; $('nutKy').setAttribute('aria-expanded', 'false'); }
  $('nutKy').onclick = function () { document.body.classList.contains('mo-ky') ? dongKy() : moKy(); };
  $('nenKy').onclick = dongKy;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') dongKy(); });
  $('nutMoi').onclick = function () { dongKy(); tai(true); song(true); if (document.body.getAttribute('data-tab') === 'tangtruong') taiTangTruong(true); };

  // loai 'do' = chữ từ GA/mạng → textContent; chỉ thông báo cố định của trang mới dùng innerHTML.
  function bao(noiDung, loai) {
    var b = $('bao'); if (!noiDung) { b.hidden = true; return; }
    b.hidden = false; b.className = 'bao' + (loai ? ' ' + loai : '');
    if (loai === 'do') b.textContent = noiDung; else b.innerHTML = noiDung;
  }
  function loiO(id, msg) { var p = $('loi-' + id); if (!p) return; p.hidden = !msg; p.textContent = msg || ''; }

  /*
   * TẢI TỪNG Ô (19.11.2026, chủ dự án: "có thể lazyload từng thành phần ko?"). Trước đây một lần mở trang
   * bắn 29 báo cáo GA cùng lúc → GA4 (10 request đồng thời mỗi thuộc tính) trả 429. Nay mỗi khung
   * [data-phan] chỉ tải khi cuộn tới gần (rootMargin 200px), qua hàng đợi tối đa 3 ô cùng lúc. Ô lỗi hiện
   * lỗi riêng + nút "Thử lại"; GA bận (429/503) thì tự thử lại theo Retry-After. Đổi khoảng → huỷ lượt đang
   * tải (AbortController). Tự làm mới chỉ làm mới ô đang hiện.
   */
  var PHAN = ['kpi', 'chuoi', 'nen_tang', 'quoc_gia', 'heat', 'choi', 'nguoi_moi', 'online', 'loi_js', 'khac'];
  var TOI_DA = 3;
  var o = {};
  PHAN.forEach(function (p) { o[p] = { tt: 'chua', g: null, lucHoi: 0, lan: 0, hen: 0, moi: false }; });
  var theHe = 0, ac = new AbortController(), hang = [], dangChay = 0, kyHien = null, emailHien = '';

  var nuocVi = function (code) { try { return tenNuoc ? tenNuoc.of(code) : code; } catch (e) { return code; } };
  var nguyen = function (x) { return x; };
  // phan = ô ở server · khoa = khoá trong danhSach (quocGia: g.quocGia) · loi = khoá trong g.loi
  /* Ô danh sách thuộc tab nào (khoá DS → tab). Thiếu khoá thì về Tổng quan. */
  var TAB_DS = { quocGia: 'nguoi', nguon: 'nguoi', pheu: 'nguoi', dang_nhap: 'nguoi', chia_se: 'nguoi',
    che_do: 'choi', so_the: 'choi', theme: 'choi', tinh_nang: 'choi', man_kho: 'choi',
    cach_vao: 'online', roi_phong: 'online', ket_noi: 'online', su_co: 'online',
    loi_js: 'kythuat', ban_web: 'kythuat', ota: 'kythuat' };
  var DS = [
    { phan: 'quoc_gia', khoa: 'quocGia', tieu: 'Quốc gia', mau: '#fcd34d', ten: nuocVi, loi: 'quoc_gia' },
    { phan: 'choi', khoa: 'che_do', tieu: 'Chế độ chơi', mau: '#86efac', ten: function (x) { return CHE_DO[x] || (x.indexOf('tim_the_may_') === 0 ? 'Tìm Thẻ · đấu máy ' + x.slice(12) : x); }, loi: 'che_do' },
    { phan: 'choi', khoa: 'so_the', tieu: 'Cỡ bàn hay chơi', mau: '#67e8f9', ten: function (x) { return x + ' thẻ'; }, loi: 'so_the' },
    { phan: 'choi', khoa: 'theme', tieu: 'Chủ đề hay chọn', mau: '#e3a6ff', ten: function (x) { return THEME[x] || x; }, loi: 'theme' },
    { phan: 'choi', khoa: 'cach_vao', tieu: 'Cách vào phòng online', mau: '#fca5a5', ten: function (x) { return CACH_VAO[x] || x; }, loi: 'chuc_nang' },
    { phan: 'choi', khoa: 'tinh_nang', tieu: 'Tính năng được dùng', mau: '#5eead4', ten: function (x) { return TINH_NANG[x] || x; }, loi: 'chuc_nang' },
    { phan: 'choi', khoa: 'ban_web', tieu: 'Phiên bản web', mau: '#8b7dff', ten: nguyen, loi: 'ban_web' },
    { phan: 'nguoi_moi', khoa: 'pheu', tieu: 'Phễu người mới', mau: '#86efac', ten: function (x) { return PHEU[x] || x; }, loi: 'pheu',
      so: function (r, ds) { var dau = ds[0] && ds[0].v; return so(r.v) + (dau ? ' · ' + Math.round(r.v / dau * 100) + '%' : ''); } },
    { phan: 'nguoi_moi', khoa: 'nguon', tieu: 'Nguồn người chơi', mau: '#fcd34d', ten: dich, loi: 'nguon' },
    { phan: 'nguoi_moi', khoa: 'man_kho', tieu: 'Màn chiến dịch khó (thua + bỏ dở)', mau: '#fca5a5', ten: function (x) { return 'Màn ' + x; }, loi: 'man_kho', tran: 100,
      so: function (r) { return r.v + '% · ' + so(r.luot) + ' lượt'; } },
    { phan: 'loi_js', khoa: 'loi_js', tieu: 'Lỗi JavaScript', mau: '#fca5a5', ten: nguyen, loi: 'loi_js' },
    { phan: 'online', khoa: 'roi_phong', tieu: 'Rời phòng online vì', mau: '#67e8f9', ten: dich, loi: 'roi_phong' },
    { phan: 'online', khoa: 'ket_noi', tieu: 'Kết nối online', mau: '#67e8f9', ten: dich, loi: 'ket_noi' },
    { phan: 'online', khoa: 'su_co', tieu: 'Sự cố mạng online (app tự cứu)', mau: '#fca5a5', ten: dich, loi: 'su_co' },
    { phan: 'khac', khoa: 'dang_nhap', tieu: 'Đăng nhập', mau: '#8b7dff', ten: dich, loi: 'dang_nhap' },
    { phan: 'khac', khoa: 'chia_se', tieu: 'Chia sẻ', mau: '#e3a6ff', ten: dich, loi: 'chia_se' },
    { phan: 'khac', khoa: 'ota', tieu: 'Cập nhật nóng (OTA)', mau: '#86efac', ten: dich, loi: 'ota' }
  ];

  function dungDs() {
    var c = $('danhSach');
    DS.forEach(function (x, i) {
      var b = el('div', 'thach the o-ds'); b.setAttribute('data-phan', x.phan); b.setAttribute('data-ds', String(i)); b.setAttribute('data-tab', TAB_DS[x.khoa] || 'tong');
      var t = el('div', 'tieu'); t.appendChild(el('h2', 'ktieu', x.tieu)); b.appendChild(t);
      var than = el('div', 'ds-than');
      [['40%', 14], ['100%', 22], ['100%', 22]].forEach(function (k) { var s = el('span', 'sk'); s.style.width = k[0]; s.style.height = k[1] + 'px'; than.appendChild(s); });
      b.appendChild(than); c.appendChild(b);
    });
  }
  // 30 phút (GA Realtime) chỉ có Quốc gia trong các ô danh sách → ẩn ô khác (ô ẩn không bị tải)
  function apDungKhoang() {
    Array.prototype.forEach.call(document.querySelectorAll('.o-ds'), function (b) {
      b.hidden = tt.khoang === '30m' && b.getAttribute('data-phan') !== 'quoc_gia';
    });
  }

  function cacO(p) { return Array.prototype.slice.call(document.querySelectorAll('[data-phan="' + p + '"]')); }
  function gan(p) { return cacO(p).some(function (e) { return e._gan && !e.hidden; }); }
  function moNhip(p, bat) { cacO(p).forEach(function (e) { e.classList.toggle('cho-o', bat); }); }

  // Thanh chạy trên đầu khi còn ô đang tải; hết thì tắt vòng xoay ở nút vừa bấm.
  function batTai() {
    var bat = dangChay > 0 || hang.length > 0;
    document.body.classList.toggle('dang-tai', bat);
    $('khung').setAttribute('aria-busy', String(bat));
    if (!bat) quay(null);
  }
  function quay(nut) {
    Array.prototype.forEach.call(document.querySelectorAll('.chip.quay'), function (n) { n.classList.remove('quay'); });
    if (nut) nut.classList.add('quay');
  }

  function thamSo(moi) {
    var q = new URLSearchParams({ khoang: tt.khoang });
    if (tt.hat) q.set('hat', tt.hat);
    if (tt.khoang === 'custom') { q.set('tu', tt.tu); q.set('den', tt.den); }
    if (moi) q.set('moi', '1');
    return q.toString();
  }

  function xepHang(p) {
    var s = o[p];
    if (s.tt === 'cho' || s.tt === 'dang') return;
    clearTimeout(s.hen); s.hen = 0;
    s.tt = 'cho'; hang.push(p); moNhip(p, true);
    chay();
  }
  function chay() {
    while (dangChay < TOI_DA && hang.length) {
      var p = hang.shift();
      if (o[p].tt !== 'cho') continue;
      dangChay++;
      taiO(p).then(function () { dangChay--; chay(); });
    }
    batTai();
  }

  // Không bao giờ reject. Lượt cũ (đã đổi khoảng: theHe khác; đã hỏi lại ô: lan khác) bị bỏ qua.
  function taiO(p) {
    var s = o[p], the = theHe, lan = ++s.lan, moi = s.moi;
    s.moi = false; s.tt = 'dang'; s.lucHoi = Date.now();
    var conDung = function () { return the === theHe && lan === s.lan; };
    return fetch('/api/o/' + p + '?' + thamSo(moi), { credentials: 'same-origin', signal: ac.signal }).then(function (r) {
      if (r.status === 403 || r.redirected) { location.reload(); return null; }
      var sau = parseInt(r.headers.get('retry-after') || '', 10) || 0;
      return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j, sau: sau }; });
    }).then(function (kq) {
      if (!kq || !conDung()) return;
      moNhip(p, false);
      if (kq.j.chuaCauHinh) {
        s.tt = 'loi';
        bao('Chưa nối GA: cần đặt bí mật <code>GA_SA_JSON</code> và <code>GA_PROPERTY_ID</code> cho Worker <code>latthe-admin</code> (xem admin/README.md).');
        trangThai(p, 'Chưa nối GA.', 0); return;
      }
      if (kq.s !== 200) {
        s.tt = 'loi';
        var ban = kq.s === 429 || kq.s === 503;
        trangThai(p, kq.j.loiChung || ('Lỗi ' + kq.s), ban ? (kq.sau || 5) : 0);
        return;
      }
      s.tt = 'xong'; s.g = kq.j;
      if (kq.j.email) { emailHien = kq.j.email; $('nguoi').textContent = 'Đăng xuất'; }
      if (!kyHien && kq.j.ky) { kyHien = kq.j.ky; veKy(kq.j); }
      try { VE[p](kq.j); } catch (e) { trangThai(p, 'Lỗi vẽ ô: ' + e.message, 0); return; }
      trangThai(p, kq.j.cu ? 'cu' : '', 0);
    }).catch(function (e) {
      if (!conDung()) return;               // gồm AbortError khi đổi khoảng
      moNhip(p, false); s.tt = 'loi';
      trangThai(p, 'Không tải được: ' + e.message, 0);
    }).then(function () { if (the === theHe) capNhatTuoi(); });
  }

  function giayDoc(n) { return n >= 120 ? Math.round(n / 60) + ' phút' : n + ' giây'; }
  function gioPhut(iso) { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }

  // Dòng trạng thái của ô: '' = ẩn · 'cu' = đang hiện số cũ · chữ khác = lỗi + nút Thử lại (sau > 0: tự thử lại)
  function trangThai(p, msg, sau) {
    var s = o[p];
    cacO(p).forEach(function (e) {
      var t = e.querySelector('.o-trang');
      if (!t) { t = el('div', 'o-trang'); t.setAttribute('role', 'status'); e.appendChild(t); }
      t.textContent = ''; t.className = 'o-trang'; t.hidden = !msg;
      if (!msg) return;
      if (msg === 'cu') {
        t.classList.add('cu');
        t.textContent = 'Đang hiện số cũ lúc ' + gioPhut(s.g.capNhat) + ' — GA đang bận, sẽ tự hỏi lại.';
        return;
      }
      t.classList.add('loi');
      t.appendChild(el('span', null, msg + (sau ? ' · tự thử lại sau ' + giayDoc(sau) : '')));
      var b = el('button', 'chip', 'Thử lại'); b.type = 'button';
      b.onclick = function () { xepHang(p); };
      t.appendChild(b);
    });
    if (sau) s.hen = setTimeout(function () { s.hen = 0; if (s.tt !== 'loi') return; if (gan(p)) xepHang(p); else s.tt = 'chua'; }, sau * 1000);
  }

  // Đổi khoảng / Làm mới: huỷ lượt đang tải, mọi ô về "chưa tải", tải lại ô đang hiện (ô khác tải khi cuộn tới).
  function tai(moi, nutBam) {
    theHe++; ac.abort(); ac = new AbortController(); hang = [];
    kyHien = null;
    quay(nutBam || (moi ? $('nutMoi') : document.querySelector('#khoang .chip.chon') || $('nutTuyChon')));
    $('capNhat').textContent = 'admin.cozypi.com · đang tải…';
    bao('');
    apDungKhoang();
    PHAN.forEach(function (p) {
      var s = o[p]; clearTimeout(s.hen); s.hen = 0; s.tt = 'chua'; s.g = null; s.moi = !!moi;
      moNhip(p, true);
      cacO(p).forEach(function (e) { var t = e.querySelector('.o-trang'); if (t) t.hidden = true; });
    });
    PHAN.forEach(function (p) { if (gan(p)) xepHang(p); });
  }

  function song(moi) {
    fetch('/api/dang-dien-ra' + (moi ? '?moi=1' : ''), { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var c = $('song'); c.textContent = '';
      if (!j || j.chuaCauHinh) { c.appendChild(el('span', 'mo', 'chưa có số')); return; }
      var nuoc = Array.isArray(j.quocGia) ? j.quocGia : [];
      var sn = $('songNho'); if (sn) sn.querySelector('b').textContent = so(j.nguoi);
      [[j.nguoi, 'người · 30 phút'], [j.van, 'ván bắt đầu']].forEach(function (x) {
        var d = el('div'); d.appendChild(el('b', null, so(x[0]))); d.appendChild(el('span', 'k', x[1])); c.appendChild(d);
      });
      var dn = el('div', 'song-nuoc');
      if (!nuoc.length) dn.appendChild(el('span', 'k', j.quocGia ? 'chưa có nước nào' : 'chưa có số nước'));
      nuoc.forEach(function (r) { var t = el('span', 'nuoc'); t.title = tenNuocVi(r.k); t.appendChild(coNuoc(r.k)); t.appendChild(el('span', 'ten-nuoc', tenNuocVi(r.k) + ' ')); t.appendChild(el('b', null, so(r.v))); dn.appendChild(t); });
      c.appendChild(dn);
    }).catch(function () {});
  }

  function doi(v, truoc) {
    if (v == null || truoc == null) return null;
    if (!truoc) return v ? { t: 'mới có số', c: 'len' } : null;
    var p = Math.round((v - truoc) / truoc * 100);
    return { t: (p > 0 ? '▲' : p < 0 ? '▼' : '±') + Math.abs(p) + '%', c: p > 0 ? 'len' : p < 0 ? 'xuong' : '' };
  }
  function ngay(d) { return d.split('-').reverse().join('.'); }

  function veKy(g) {
    var tenKhoang = (KHOANG.find(function (k) { return k[0] === g.khoang; }) || ['', 'Tuỳ chọn'])[1];
    var kc = $('kyChon'); kc.textContent = 'Thống kê theo khoảng: ';
    kc.appendChild(el('b', null, tenKhoang + (g.ky ? ' · ' + (g.ky.startDate === g.ky.endDate ? ngay(g.ky.startDate) : ngay(g.ky.startDate) + ' → ' + ngay(g.ky.endDate)) : '')));
    // Nút khoảng (điện thoại): "7 ngày · 22–28.11"
    var ngan = function (d) { var x = d.split('-'); return x[2] + '.' + x[1]; };
    $('nutKyChu').textContent = tenKhoang + (g.ky && g.khoang !== '30m' ? ' · ' + (g.ky.startDate === g.ky.endDate ? ngan(g.ky.startDate) : ngan(g.ky.startDate).split('.')[0] + '–' + ngan(g.ky.endDate)) : '');
  }

  function veKpi(g) {
    var k = g.kpi || {}, c = $('kpi'); c.textContent = '';
    var phut = k.giayMoiNguoi && k.giayMoiNguoi.v != null ? Math.floor(k.giayMoiNguoi.v / 60) + ':' + String(k.giayMoiNguoi.v % 60).padStart(2, '0') : null;
    [
      ['Người chơi hoạt động', k.nguoi, null],
      ['Người chơi mới', k.nguoiMoi, null],
      ['Ván đã chơi', k.van, k.vanXong && k.vanXong.v != null ? so(k.vanXong.v) + ' ván chơi tới cuối' : null],
      ['Ván online', k.vanOnline, null],
      ['Phòng online đã tạo', k.phongTao, null],
      ['Người quay lại', k.quayLai && k.quayLai.v != null ? { v: k.quayLai.v + '%' } : k.quayLai, 'trong số người chơi của kỳ'],
      ['Tài khoản mới', k.taiKhoanMoi, 'đăng nhập Google/Apple lần đầu'],
      ['Thời gian chơi TB', phut == null ? k.giayMoiNguoi : { v: phut }, 'phút:giây mỗi người']
    ].forEach(function (x) {
      if (g.khoang === '30m' && x[1] == null) return;
      var b = el('div', 'thach kpi');
      var tren = el('div', 'kpi-dau');
      tren.appendChild(el('span', 'nhan', x[0]));
      b.appendChild(tren);
      var v = x[1] ? x[1].v : null;
      // GỌN (28.11.2026): mức tăng/giảm đứng CẠNH con số ("▲109%"), "so với kỳ trước" ghi một lần ở tiêu đề nhóm
      var hang = el('div', 'kpi-so');
      hang.appendChild(el('b', null, typeof v === 'string' ? v : so(v)));
      var d = x[1] ? doi(x[1].v, x[1].truoc) : null;
      if (d) hang.appendChild(el('span', 'doi' + (d.c ? ' ' + d.c : ''), d.t));
      b.appendChild(hang);
      var ghi = x[2] || (v == null ? 'chưa có số (xem lỗi bên dưới)' : '');
      if (ghi) b.appendChild(el('span', 'kpi-ghi', ghi));
      c.appendChild(b);
    });
    var l = g.loi || {};
    loiO('kpi', [l.kpi, l.che_do, l.chuc_nang, l.dang_nhap].filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(' · '));
  }

  function veChuoi(g) {
    var hatTen = HAT[g.hat] || g.hat;
    $('tieuChuoi').textContent = 'Người chơi hoạt động theo ' + hatTen.toLowerCase();
    var hc = $('hat'); hc.textContent = '';
    (g.hatDuocChon || []).forEach(function (h) {
      var b = el('button', 'chip' + (h === g.hat ? ' chon' : ''), HAT[h] || h); b.type = 'button';
      // đổi hạt chỉ đổi ô biểu đồ — các ô khác không phụ thuộc hạt
      b.onclick = function () { tt.hat = h; quay(b); o.chuoi.tt = 'chua'; xepHang('chuoi'); };
      hc.appendChild(b);
    });
    $('ghiChuoi').textContent = g.hat === '5m' ? 'Ước lượng từ GA Realtime (người hoạt động mỗi phút, lấy mức cao nhất trong 5 phút)'
      : 'Kỳ ' + ngay(g.ky.startDate) + ' → ' + ngay(g.ky.endDate) + ' · giờ theo thuộc tính GA';
    var cg = $('chuGiai'); cg.textContent = '';
    var ch = g.chuoi || { cot: [], nhom: [] };
    ch.nhom.forEach(function (n) { var s = el('span'); s.appendChild(iconNt(n.id)); s.appendChild(document.createTextNode(n.ten)); cg.appendChild(s); });
    var cot = ch.cot, nhom = ch.nhom, vung = $('chuoi'); vung.textContent = '';
    var tong = cot.map(function (_, i) { return nhom.reduce(function (s, n) { return s + (n.gia[i] || 0); }, 0); });
    var max = Math.max.apply(null, tong.concat([1]));
    var buoc = Math.max(1, Math.ceil(cot.length / 24));
    vung.style.minWidth = Math.max(0, cot.length * 9) + 'px';
    cot.forEach(function (ct, i) {
      var b = el('div', 'cot' + (ct.moc ? ' moc' : ''));
      b.title = ct.nhan + ': ' + nhom.map(function (n) { return n.ten + ' ' + so(n.gia[i]); }).join(' · ');
      if (cot.length <= 31) b.appendChild(el('span', 'so', so(tong[i])));
      var khoi = el('div', 'khoi');
      nhom.forEach(function (n) { var q = el('div'); q.style.height = Math.round((n.gia[i] || 0) / max * 190) + 'px'; q.style.background = MAU[n.id]; khoi.appendChild(q); });
      b.appendChild(khoi);
      if (i % buoc === 0 || ct.moc) b.appendChild(el('span', 'nhan', ct.nhan));
      vung.appendChild(b);
    });
    loiO('chuoi', (g.loi || {}).chuoi);
  }

  function veNenTang(g) {
    var nt = g.nenTang || [], tnt = nt.reduce(function (s, x) { return s + x.v; }, 0), th = $('thanhNt'), dsNt = $('nenTang');
    th.textContent = ''; dsNt.textContent = '';
    nt.forEach(function (x) {
      var p = tnt ? Math.round(x.v / tnt * 100) : 0;
      var seg = el('div'); seg.style.width = p + '%'; seg.style.background = MAU[x.id]; th.appendChild(seg);
      var d = el('div', 'nt-dong'); var t = el('span'); t.appendChild(iconNt(x.id)); t.appendChild(document.createTextNode(x.ten));
      var v = el('b', null, so(x.v)); v.appendChild(el('small', null, p + '%'));
      d.appendChild(t); d.appendChild(v); dsNt.appendChild(d);
    });
    if (!nt.length) dsNt.appendChild(el('p', 'mo', g.khongCo ? 'Realtime không tách được nền tảng.' : 'Không có số.'));
    loiO('nen_tang', (g.loi || {}).nen_tang);
  }

  // Heatmap (GA dayOfWeek: 0 = Chủ nhật) — hiển thị T2 → CN
  function veHeat(g) {
    var hm = $('heat'); hm.textContent = '';
    if (g.heat) {
      var mx = Math.max.apply(null, g.heat.map(function (r) { return Math.max.apply(null, r); }).concat([1]));
      var dinh = { v: -1, d: 0, h: 0 };
      var dongGio = el('div', 'h gio'); dongGio.appendChild(el('span'));
      for (var h = 0; h < 24; h++) dongGio.appendChild(el('span', null, h % 3 === 0 ? String(h).padStart(2, '0') : ''));
      hm.appendChild(dongGio);
      [1, 2, 3, 4, 5, 6, 0].forEach(function (d) {
        var r = el('div', 'h'); r.appendChild(el('span', null, THU[d]));
        g.heat[d].forEach(function (v, h) {
          if (v > dinh.v) dinh = { v: v, d: d, h: h };
          var b = el('div', 'o'); var lv = v ? Math.min(4, Math.ceil(v / mx * 4)) : 0;
          b.style.background = HEAT[lv]; b.title = THU[d] + ' ' + String(h).padStart(2, '0') + ':00 · ' + so(v) + ' ván';
          r.appendChild(b);
        });
        hm.appendChild(r);
      });
      $('ghiHeat').textContent = dinh.v > 0 ? 'Cao nhất: ' + THU[dinh.d] + ' ' + String(dinh.h).padStart(2, '0') + ':00 (' + so(dinh.v) + ' ván)' : '';
    } else {
      $('ghiHeat').textContent = g.khongCo ? 'Không có ở chế độ 30 phút' : '';
    }
    loiO('heat', (g.loi || {}).heat);
  }

  // Các ô danh sách của MỘT phần (vd 'choi' vẽ 5 ô)
  function veDs(g) {
    var loi = g.loi || {}, ghi = g.ghiChu || {};
    cacO(g.phan).forEach(function (b) {
      var x = DS[Number(b.getAttribute('data-ds'))]; if (!x) return;
      var than = b.querySelector('.ds-than'); than.textContent = '';
      var ds = (x.khoa === 'quocGia' ? g.quocGia : (g.danhSach || {})[x.khoa]) || [];
      var m = x.tran || Math.max.apply(null, ds.map(function (r) { return r.v; }).concat([1]));
      ds.forEach(function (r) {
        var d = el('div', 'ds-dong'); var tr = el('div', 'tren'); var nh = el('span');
        if (x.khoa === 'quocGia') nh.appendChild(coNuoc(r.k));
        nh.appendChild(document.createTextNode(x.ten(r.k)));
        if (r.phu) nh.appendChild(el('small', 'ngan-xep', r.phu));       // lỗi JS: chỗ lỗi trong mã (tệp:dòng:cột)
        tr.appendChild(nh); tr.appendChild(el('span', null, x.so ? x.so(r, ds) : so(r.v)));
        var ray = el('div', 'ray'); var f = el('div'); f.style.width = Math.max(2, Math.round(r.v / m * 100)) + '%'; f.style.background = x.mau; ray.appendChild(f);
        d.appendChild(tr); d.appendChild(ray); than.appendChild(d);
      });
      if (loi[x.loi]) than.appendChild(el('p', 'loi-o', loi[x.loi]));
      else if (!ds.length) than.appendChild(el('p', 'mo', 'Chưa có số trong kỳ này.'));
      if (ghi[x.khoa]) than.appendChild(el('p', 'ghi-o', ghi[x.khoa]));
    });
  }

  var VE = { kpi: veKpi, chuoi: veChuoi, nen_tang: veNenTang, heat: veHeat,
    quoc_gia: veDs, choi: veDs, nguoi_moi: veDs, online: veDs, loi_js: veDs, khac: veDs };

  /*
   * TỰ LÀM MỚI (17.11.2026): khoảng có HÔM NAY thì số còn đổi → tự hỏi lại khi số đã cũ 5 phút (đúng bằng
   * thời gian server nhớ tạm — hỏi sớm hơn cũng chỉ nhận lại số cũ); khoảng 30 phút thì 1 phút. Khoảng đã
   * qua (Hôm qua…) không làm mới. Chỉ chạy khi tab đang hiện, và (19.11.2026) chỉ ô đang hiện — ô khác
   * hỏi lại khi cuộn tới. Ô đang hiện số cũ (GA bận) cũng hỏi lại, nhưng mỗi ô cách nhau ≥ 1 phút.
   */
  var lucSong = Date.now();
  function homNay() { return new Date().toLocaleDateString('sv-SE'); }
  function conChay() { return tt.khoang === '30m' || (!!kyHien && kyHien.endDate >= homNay()); }
  function hanMs() { return tt.khoang === '30m' ? 60000 : 300000; }
  function canMoi(p) {
    var s = o[p], bay = Date.now();
    if (s.tt !== 'xong' || !s.g || bay - s.lucHoi < 60000) return false;
    return !!s.g.cu || (conChay() && bay - new Date(s.g.capNhat).getTime() >= hanMs());
  }
  // Giờ số = số CŨ NHẤT trong các ô đã tải
  function capNhatTuoi() {
    var cu = null;
    PHAN.forEach(function (p) { var g = o[p].g; if (o[p].tt === 'xong' && g && g.capNhat && (!cu || g.capNhat < cu)) cu = g.capNhat; });
    if (!cu) return;
    var phut = Math.floor((Date.now() - new Date(cu).getTime()) / 60000);
    $('capNhat').textContent = 'admin.cozypi.com · ' + (emailHien || '') + ' · số lúc ' + gioPhut(cu)
      + ' (' + (phut < 1 ? 'vừa xong' : phut + ' phút trước') + ')' + (conChay() ? ' · tự làm mới' : '');
  }
  function kiemMoi() {
    if (document.hidden) return;
    capNhatTuoi();
    PHAN.forEach(function (p) { if (gan(p) && canMoi(p)) xepHang(p); });
  }

  dungDs(); veKhoang(); tai(false); song(false);
  /* ---- CHIA TAB ---- */
  var TABS = ['tong', 'tangtruong', 'nguoi', 'choi', 'online', 'kythuat'];
  var HASH_TAB = { 'tong-quan': 'tong', 'tang-truong': 'tangtruong', nguoi: 'nguoi', choi: 'choi', online: 'online', 'ky-thuat': 'kythuat' };
  function hashCua(t) { for (var h in HASH_TAB) if (HASH_TAB[h] === t) return h; return 'tong-quan'; }
  function chonTab(t, ghi) {
    if (TABS.indexOf(t) < 0) t = 'tong';
    document.body.setAttribute('data-tab', t);
    Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (e) {
      if (e === document.body) return;
      e.classList.toggle('ngoai-tab', e.getAttribute('data-tab') !== t);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-chon-tab]'), function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-chon-tab') === t));
    });
    if (ghi) { try { history.replaceState(null, '', '#' + hashCua(t)); } catch (e) { /* bỏ */ } window.scrollTo(0, 0); }
    if (t === 'tangtruong' && typeof ttDang === 'boolean') taiTangTruong(false);   // trước khi khởi tạo (lần gọi đầu) thì đoạn cuối file tự tải
  }
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-chon-tab]'); if (b) chonTab(b.getAttribute('data-chon-tab'), true);
  });
  window.addEventListener('hashchange', function () { chonTab(HASH_TAB[location.hash.slice(1)], false); });
  chonTab(HASH_TAB[location.hash.slice(1)], false);

  // Quan sát MỌI khung [data-phan]: tới gần màn hình 200px thì tải (lần đầu) hoặc làm mới (nếu số đã cũ).
  var cacKhung = Array.prototype.slice.call(document.querySelectorAll('[data-phan]'));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (ds) {
      ds.forEach(function (d) { d.target._gan = d.isIntersecting; });
      PHAN.forEach(function (p) { if (gan(p) && (o[p].tt === 'chua' || canMoi(p))) xepHang(p); });
      batTai();
    }, { rootMargin: '200px 0px' });
    cacKhung.forEach(function (e) { io.observe(e); });
  } else {
    cacKhung.forEach(function (e) { e._gan = true; });
    PHAN.forEach(function (p) { if (gan(p)) xepHang(p); });
  }
  /*
   * TAB TĂNG TRƯỞNG (28.11.2026): /api/tangtruong — một gói, 28 ngày trọn tới hôm qua, không theo bộ chọn khoảng.
   * Chỉ tải khi mở tab (9 báo cáo GA), Worker nhớ 1 giờ; nút "Làm mới" hỏi lại GA.
   */
  var ttTai = 0, ttDang = false;
  var TEN_LAN = { chia_se: 'Bấm chia sẻ', luu_chia_se_anh: 'Lưu / chia sẻ ảnh kết quả', tri_nho_chia_se: 'Chia sẻ Chỉ số trí nhớ', online_moi_ban: 'Bấm mời bạn vào phòng',
    online_vao_link_moi: 'Vào phòng bằng link mời', moi_qua_link: '↳ trong đó là người MỚI', thong_bao_bat: 'Bật thông báo', dang_nhap: 'Đăng nhập' };
  function bangTt(id, dau, hang) {
    var tb = $(id); tb.textContent = '';
    if (!hang || !hang.length) { tb.appendChild(el('caption', 'mo', 'Chưa có số.')); return; }
    dau.forEach(function (ds) { var h = tb.createTHead().insertRow(); ds.forEach(function (k) { var th = el('th', k[1] || null, k[0]); if (k[2]) th.colSpan = k[2]; h.appendChild(th); }); });
    var body = tb.createTBody();
    hang.forEach(function (r) { var tr = body.insertRow(); r.forEach(function (o) { var c = Array.isArray(o) ? o : [o]; tr.appendChild(el('td', c[1] || null, typeof c[0] === 'number' ? so(c[0]) : String(c[0] == null ? '–' : c[0]))); }); });
  }
  function ptO(a, b, tot, kem) { if (!b) return ['–']; var p = Math.round(a / b * 100); return [p + '%', b < 10 ? '' : p >= tot ? 'tot' : p < kem ? 'kem' : '']; }
  function so1(x) { return x == null ? '—' : Number(x).toLocaleString('vi-VN', { maximumFractionDigits: 1 }); }
  function veTangTruong(g) {
    var t = g.tong, d = $('ttDich'); d.textContent = '';
    if (t) {
      var hs = el('div', 'hang-so');
      hs.appendChild(el('b', null, so1(t.tb7))); hs.appendChild(el('span', null, '/ ' + so(g.mucTieu) + ' người online trung bình · 7 ngày qua'));
      d.appendChild(hs);
      var ray = el('div', 'ray'), i = el('i'); i.style.width = Math.min(100, t.tb7 / g.mucTieu * 100) + '%'; ray.appendChild(i); d.appendChild(ray);
      var gap = t.tb7 > 0 ? g.mucTieu / t.tb7 : 0;
      d.appendChild(el('p', null, (gap ? 'Còn cách mục tiêu ' + so1(gap) + ' lần · ' : '') + 'tính từ tổng thời gian chơi GA đo được (' + so1(t.gio7) + ' giờ chơi mỗi ngày), chia đều 24 giờ'));
      var c = $('ttKpi'); c.textContent = '';
      var gc = (g.giuChan || []).filter(function (x) { return x.du7; })[0], n1 = (g.giuChan || [])[0];
      var app = function (x, k) { return x ? x.nen.ios[k] + x.nen.android[k] : 0; };
      var kh = (g.kichHoat || []).filter(function (x) { return x.id !== 'web'; }), khMoi = kh.reduce(function (s, x) { return s + x.moi; }, 0), khXong = kh.reduce(function (s, x) { return s + x.xong; }, 0);
      [
        ['Online trung bình', so1(t.tb7), doi(t.tb7, t.tb7Truoc), '7 ngày trước: ' + so1(t.tb7Truoc)],
        ['Online giờ đỉnh', so1(t.dinh7), null, 'trung bình giờ đông nhất mỗi ngày'],
        ['Người mới · 7 ngày', so(t.moi7), doi(t.moi7, t.moi7Truoc), so(t.nguoi7) + ' người chơi mỗi ngày'],
        ['Chơi xong ván đầu · app', khMoi ? Math.round(khXong / khMoi * 100) + '%' : '—', null, so(khXong) + '/' + so(khMoi) + ' người mới · 28 ngày'],
        ['Quay lại ngày 1 · app', n1 && app(n1, 'moi') ? Math.round(app(n1, 'n1') / app(n1, 'moi') * 100) + '%' : '—', null, n1 ? 'nhóm ' + n1.nhan + ' · ' + so(app(n1, 'moi')) + ' người mới' : ''],
        ['Quay lại ngày 7 · app', gc && app(gc, 'moi') ? Math.round(app(gc, 'n7') / app(gc, 'moi') * 100) + '%' : '—', null, gc ? 'nhóm ' + gc.nhan + ' · ' + so(app(gc, 'moi')) + ' người mới' : '']
      ].forEach(function (x) {
        var b = el('div', 'thach kpi'), tren = el('div', 'kpi-dau'); tren.appendChild(el('span', 'nhan', x[0])); b.appendChild(tren);
        var hang = el('div', 'kpi-so'); hang.appendChild(el('b', null, x[1]));
        if (x[2]) hang.appendChild(el('span', 'doi ' + x[2].c, x[2].t));
        b.appendChild(hang); b.appendChild(el('span', 'kpi-ghi', x[3])); c.appendChild(b);
      });
    }
    var cot = $('ttCot'); cot.textContent = '';
    var ng = g.ngay || [], mx = Math.max.apply(null, ng.map(function (x) { return Math.max(x.tb, x.dinh || 0); }).concat([0.1]));
    ng.forEach(function (x, i) {
      var b = el('div', 'cot' + (i % 7 === 0 ? ' moc' : ''));
      b.title = x.nhan + ': trung bình ' + so1(x.tb) + ' · giờ đỉnh ' + so1(x.dinh) + ' · ' + so(x.nguoi) + ' người chơi · ' + so(x.moi) + ' mới';
      if (i === ng.length - 1 || i % 7 === 0) b.appendChild(el('span', 'so', so1(x.tb)));
      var khoi = el('div', 'khoi'); khoi.style.height = Math.max(2, Math.round(x.tb / mx * 190)) + 'px'; b.appendChild(khoi);
      if (x.dinh != null) { var v = el('i', 'dinh'); v.style.bottom = Math.round(x.dinh / mx * 190) + 'px'; b.appendChild(v); }
      if (i % 7 === 0 || i === ng.length - 1) b.appendChild(el('span', 'nhan', x.nhan));
      cot.appendChild(b);
    });
    var NT = [['ios', 'iOS'], ['android', 'Android'], ['web', 'Web']];
    bangTt('ttGiuChan',
      [[['Lần đầu vào']].concat(NT.map(function (n) { return [n[1], 'nhom', 3]; })),
       [['tuần']].concat(NT.reduce(function (a) { return a.concat([['mới', 'vach'], ['ngày 1'], ['ngày 7']]); }, []))],
      (g.giuChan || []).map(function (r) {
        return [r.nhan + (r.du7 ? '' : ' · đang chạy')].concat(NT.reduce(function (a, n) {
          var x = r.nen[n[0]]; return a.concat([[x.moi, 'vach'], ptO(x.n1, x.moi, 30, 15), x.n7 == null ? ['…'] : ptO(x.n7, x.moi, 12, 5)]);
        }, []));
      }));
    bangTt('ttKichHoat', [[['Nền tảng'], ['Người mới'], ['Bắt đầu ván'], ['Chơi xong'], ['% xong']]],
      (g.kichHoat || []).map(function (x) { return [x.ten, x.moi, x.batDau, x.xong, ptO(x.xong, x.moi, 70, 40)]; }));
    bangTt('ttNguon', [[['Kênh'], ['Người mới'], ['Phút chơi / người']]],
      (g.nguon || []).map(function (x) { return [x.k, x.moi, [x.phut, x.phut === 0 ? 'kem' : '']]; }));
    var tongGio = (g.quocGia || []).reduce(function (s, x) { return s + x.gio; }, 0);
    bangTt('ttNuoc', [[['Nước'], ['Người'], ['Mới'], ['Giờ chơi'], ['% giờ']]],
      (g.quocGia || []).map(function (x) { return [co(x.k) + ' ' + tenNuocVi(x.k), x.nguoi, x.moi, so1(x.gio), tongGio ? Math.round(x.gio / tongGio * 100) + '%' : '–']; }));
    bangTt('ttLan', [[['Việc'], ['Lượt'], ['Người']]],
      (g.lanTruyen || []).map(function (x) { return [TEN_LAN[x.k] || x.k, x.luot, x.nguoi]; }));
    var ngan = function (s) { var x = s.split('-'); return x[2] + '.' + x[1]; };
    $('ttLuc').textContent = ngan(g.ky.startDate) + ' – ' + ngan(g.ky.endDate) + ' · GA' + (g.cu ? ' · đang hiện số cũ' : '');
    var l = Object.keys(g.loi || {}).map(function (k) { return g.loi[k]; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
    loiO('tangtruong', l.join(' · '));
  }
  function taiTangTruong(moi) {
    if (ttDang || (!moi && ttTai && Date.now() - ttTai < 600000)) return;
    ttDang = true; $('tangTruong').classList.add('cho-o');
    fetch('/api/tangtruong' + (moi ? '?moi=1' : ''), { credentials: 'same-origin' }).then(function (r) { return r.json().then(function (g) { return { ok: r.ok, g: g }; }); }).then(function (x) {
      if (!x.ok) { loiO('tangtruong', x.g && x.g.chuaCauHinh ? 'Chưa nối GA.' : (x.g && x.g.loiChung) || 'Không lấy được số tăng trưởng.'); return; }
      ttTai = Date.now(); veTangTruong(x.g);
    }).catch(function () { loiO('tangtruong', 'Không lấy được số tăng trưởng (mất mạng?).'); })
      .then(function () { ttDang = false; $('tangTruong').classList.remove('cho-o'); });
  }
  if (document.body.getAttribute('data-tab') === 'tangtruong') taiTangTruong(false);
  /*
   * Ô THI ĐẤU (23.11.2026): /api/thidau — máy chủ game, không qua GA nên không vào hàng đợi các ô [data-phan] và không
   * theo bộ chọn khoảng. Tải lúc mở trang + 5 phút một lần khi trang đang hiện.
   */
  function pt(a, b) { return b ? Math.round(a / b * 100) + '%' : '–'; }
  function veThiDau(g) {
    var t = g.tong || {}, c = $('tdKpi'); c.textContent = '';
    [
      ['Đợt gọi', so(t.dotGoi), so(t.hoi) + ' lượt hỏi · ' + so(t.nguoiDuocHoi) + ' người'],
      ['Bấm Tham gia', so(t.thamGia), pt(t.thamGia, t.hoi) + ' lượt hỏi · để sau ' + so(t.deSau) + ' · bỏ qua ' + so(t.boQua)],
      ['Đợt đủ người', pt(t.dotDuNguoi, t.dotChia), so(t.dotDuNguoi) + '/' + so(t.dotChia) + ' đợt · trận 2 người ' + so(t.tran2) + ' · 3 người ' + so(t.tran3)],
      ['Ván chơi hết', so(t.vanXong), 'bắt đầu ' + so(t.vanBatDau) + ' · có người rời ' + so(t.vanCoNguoiRoi) + ' · chơi lại ' + so(t.choiLai)],
      ['Giữ chờ', so(t.batDauCho), 'hết 10 phút không ai vào: ' + so(t.hetGioCho)],
      ['Tin đẩy đã gửi', so(t.pushGui), 'tắt gợi ý thi đấu: ' + so(t.tatGoiY)]
    ].forEach(function (x) {
      var b = el('div', 'thach kpi'), tren = el('div', 'kpi-dau');
      tren.appendChild(el('span', 'nhan', x[0])); b.appendChild(tren);
      b.appendChild(el('b', null, x[1])); b.appendChild(el('span', 'doi', x[2])); c.appendChild(b);
    });
    function bang(id, cot, ds) {
      var tb = $(id); tb.textContent = '';
      if (!ds || !ds.length) return;
      var h = tb.createTHead().insertRow();
      cot.forEach(function (k) { h.appendChild(el('th', null, k[0])); });
      var body = tb.createTBody();
      ds.forEach(function (r) { var tr = body.insertRow(); cot.forEach(function (k) { tr.appendChild(el('td', null, typeof r[k[1]] === 'number' ? so(r[k[1]]) : String(r[k[1]] == null ? '–' : r[k[1]]))); }); });
    }
    bang('tdBang', [['Ngày', 'ngay'], ['Đợt gọi', 'dotGoi'], ['Lượt hỏi', 'hoi'], ['Tham gia', 'thamGia'], ['Để sau', 'deSau'], ['Bỏ qua', 'boQua'], ['Đợt đủ người', 'dotDuNguoi'], ['Người vào trận', 'nguoiVaoTran'], ['Ván bắt đầu', 'vanBatDau'], ['Ván xong', 'vanXong'], ['Tin đẩy', 'pushGui'], ['Tắt gợi ý', 'tatGoiY']], g.ngay);
    var TEN_NT = { ios: 'iPhone / iPad', android: 'Android', web: 'Web' };
    bang('tdNhom', [['Nền tảng / nước', 'ten'], ['Người', 'nguoi'], ['Lượt hỏi', 'hoi'], ['Tham gia', 'thamGia']],
      (g.nenTang || []).map(function (x) { return { ten: TEN_NT[x.ten] || x.ten, nguoi: x.nguoi, hoi: x.hoi, thamGia: x.thamGia }; }).concat(g.nuoc || []));
    $('tdLuc').textContent = so(g.suKien) + ' sự kiện · từ máy chủ game · giờ Việt Nam';
  }
  function taiThiDau() {
    fetch('/api/thidau?ngay=30', { credentials: 'same-origin' }).then(function (r) { return r.json().then(function (g) { return { ok: r.ok, g: g }; }); }).then(function (x) {
      var l = $('loi-thidau');
      if (!x.ok) { l.hidden = false; l.textContent = x.g && x.g.chuaCauHinh ? 'Chưa nạp khoá thống kê thi đấu (THONGKE_KEY) cho trang này.' : 'Không lấy được số thi đấu: ' + ((x.g && x.g.loi) || 'lỗi không rõ'); return; }
      l.hidden = true; veThiDau(x.g);
    }).catch(function () { var l = $('loi-thidau'); l.hidden = false; l.textContent = 'Không lấy được số thi đấu (mất mạng?).'; });
  }
  taiThiDau();
  setInterval(function () { if (!document.hidden) taiThiDau(); }, 300000);
  /* Ô MÁY CHỦ · TRỰC TIẾP (28.11.2026): /api/maychu — 30 giây một lần khi trang đang hiện. */
  var TT_PHONG = { lobby: 'Phòng chờ', countdown: 'Đếm ngược', playing: 'Đang chơi', ended: 'Hết ván' };
  function bangMc(id, cot, ds) {
    var tb = $(id); tb.textContent = '';
    if (!ds || !ds.length) return;
    var h = tb.createTHead().insertRow();
    cot.forEach(function (k) { h.appendChild(el('th', null, k[0])); });
    var body = tb.createTBody();
    ds.forEach(function (r) { var tr = body.insertRow(); cot.forEach(function (k) { var v = typeof k[1] === 'function' ? k[1](r) : r[k[1]]; tr.appendChild(el('td', null, typeof v === 'number' ? so(v) : String(v == null ? '–' : v))); }); });
  }
  /* BẢNG MÁY CHỦ (28.11.2026): mỗi máy một hàng — CPU / RAM / swap / ổ cứng của MÁY + RAM pod. ≥ 80% vàng, ≥ 95% đỏ. */
  function mucPt(v) { return v == null ? '' : v >= 95 ? 'muc-do' : v >= 80 ? 'muc-vang' : ''; }
  function veMay(c) {
    var hop = $('mcMay'); hop.textContent = '';
    var cb = $('mcCanhBao'); cb.textContent = ''; cb.hidden = true;
    if (!c || !c.pods || !c.pods.length) return;
    c.pods.slice().sort(function (a, b) { return (a.sk && a.sk.ten || a.may) < (b.sk && b.sk.ten || b.may) ? -1 : 1; }).forEach(function (p) {
      var sk = p.sk || {}, m = sk.may || {}, pd = sk.pod || {};
      var cs = [['CPU', m.cpu], ['RAM', m.ram], ['Swap', m.swap], ['Ổ cứng', m.oDia], ['RAM pod', pd.ram]];
      var cao = cs.reduce(function (a, x) { return x[1] != null && x[1] > a ? x[1] : a; }, 0);
      var the = el('div', 'thach may');
      var dau = el('div', 'may-dau');
      dau.appendChild(el('b', null, sk.ten || p.may));
      dau.appendChild(el('span', null, so(p.phong) + ' phòng' + (p.giuSanh ? ' · giữ sảnh' : '')));
      var mu = mucPt(cao); dau.appendChild(el('span', 'tt ' + (mu || 'muc-tot'), mu === 'muc-do' ? 'nguy hiểm' : mu === 'muc-vang' ? 'cao' : 'khoẻ'));
      the.appendChild(dau);
      cs.forEach(function (x) {
        var h = el('div', 'cs'); h.appendChild(el('span', null, x[0]));
        var ray = el('div', 'ray'), i = el('i', mucPt(x[1])); i.style.width = Math.min(100, x[1] || 0) + '%'; ray.appendChild(i); h.appendChild(ray);
        h.appendChild(el('em', mucPt(x[1]), x[1] == null ? '–' : Math.round(x[1]) + '%'));
        the.appendChild(h);
      });
      the.appendChild(el('p', 'may-ghi', 'RAM ' + so(m.ramMB) + '/' + so(m.ramTongMB) + ' MB · ổ trống ' + so(m.oDiaTrongMB) + ' MB · pod ' + so(pd.ramMB) + ' MB · tải ' + (m.tai1 == null ? '–' : m.tai1)));
      hop.appendChild(the);
    });
    var ds = c.canhBao || [];
    if (ds.length) {
      cb.hidden = false;
      ds.sort(function (a, b) { return a.muc === b.muc ? 0 : a.muc === 'do' ? -1 : 1; }).forEach(function (x) {
        cb.appendChild(el('span', 'canh ' + (x.muc === 'do' ? 'muc-do' : 'muc-vang'), (x.muc === 'do' ? 'Nguy hiểm' : 'Cao') + ': ' + (x.ten || x.may) + ' · ' + x.chiSo + ' ' + Math.round(x.giaTri) + '%'));
      });
    }
  }
  function veMayChu(g) {
    var t = g.tong || {}, p = t.phong || {}, n = t.nguoiTrongPhong || {}, v = t.vanOnline || {}, c = t.nguoiChoi || {}, tk = t.taiKhoan || {}, kh = t.khach || {}, o = t.online || {};
    var so1 = $('soOnline'); if (so1) { so1.hidden = !o.sanh; so1.textContent = so(o.sanh); }
    // Dải số TRỰC TIẾP (28.11.2026, mockup duyệt): 4 số nhỏ thay 6 ô to
    var dai = $('mcDai'); dai.textContent = '';
    [[o.sanh, 'mở app'], [n.nguoiThatDangNoi, 'trong phòng'], [p.tong, 'phòng'], [n.botThuongTruc, 'bot']].forEach(function (x) {
      var d = el('div'); d.appendChild(el('b', null, so(x[0]))); d.appendChild(el('span', null, x[1])); dai.appendChild(d);
    });
    var ng = $('mcNgay'); ng.textContent = '';
    [['Ván online hôm nay', v.homNay, '7 ngày ' + so(v.bayNgay)], ['Người chơi hôm nay', c.homNay, '7 ngày ' + so(c.bayNgay)], ['Tài khoản', tk.tong, 'khách ' + so(kh.tong)]].forEach(function (x) {
      var d = el('div'); d.appendChild(el('span', null, x[0])); d.appendChild(el('b', null, so(x[1]))); d.appendChild(el('small', null, x[2])); ng.appendChild(d);
    });
    veMay(t.cum);
    bangMc('mcPhong', [['Mã', 'ma'], ['Loại', function (r) { return r.congKhai ? 'Công khai' : 'Riêng'; }], ['Trạng thái', function (r) { return TT_PHONG[r.trangThai] || r.trangThai; }],
      ['Người', function (r) { return (r.nguoi || []).map(function (x) { return x.ten + (x.may ? ' (máy)' : x.dangNoi ? '' : ' (rớt)'); }).join(', ') || '–'; }],
      ['Mở (phút)', 'moPhut'], ['Pod', function (r) { return r.pod ? String(r.pod).slice(-6) : '–'; }]], (g.phong && g.phong.phong) || []);
    $('mcLuc').textContent = 'trực tiếp · ' + new Date(t.luc || Date.now()).toLocaleTimeString('vi-VN');
  }
  function taiMayChu() {
    fetch('/api/maychu', { credentials: 'same-origin' }).then(function (r) { return r.json().then(function (g) { return { ok: r.ok, g: g }; }); }).then(function (x) {
      var l = $('loi-maychu');
      if (!x.ok) { l.hidden = false; l.textContent = x.g && x.g.chuaCauHinh ? 'Chưa nạp khoá quản trị (QUANTRI_KEY) cho trang này.' : 'Không lấy được số máy chủ: ' + ((x.g && x.g.loi) || 'lỗi không rõ'); return; }
      l.hidden = true; veMayChu(x.g);
    }).catch(function () { var l = $('loi-maychu'); l.hidden = false; l.textContent = 'Không lấy được số máy chủ (mất mạng?).'; });
  }
  taiMayChu();
  setInterval(function () { if (!document.hidden) taiMayChu(); }, 30000);
  setInterval(function () { if (!document.hidden) { song(false); lucSong = Date.now(); } }, 60000);
  setInterval(kiemMoi, 30000);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (Date.now() - lucSong > 60000) { song(false); lucSong = Date.now(); }
    kiemMoi();
  });
})();
`;
