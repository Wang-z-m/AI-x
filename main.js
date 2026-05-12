/* ================================================================== */
/*  ⚡  main.js  ·  温暖手绘风个人简历网站                             */
/*  ─────────────────────────────────────────────────────────────────  */
/*  作者: Cesare  ·  与 Claude 协作生成                                */
/*  设计哲学: 用最少的代码，做最温柔的交互                              */
/*                                                                    */
/*  本文件包含 8 个模块（IIFE 隔离 · 互不污染）:                        */
/*    1️⃣  Theme Toggle       亮 / 暗主题切换 + 持久化                 */
/*    2️⃣  Header Scroll      向下滚动时导航变毛玻璃                   */
/*    3️⃣  Mobile Menu        汉堡 → 抽屉滑出                          */
/*    4️⃣  Smooth Nav         平滑滚动 + 当前锚点高亮                  */
/*    5️⃣  Fade-in Observer   IntersectionObserver 触发渐入            */
/*    6️⃣  Logo Easter Egg    Logo 点 3 下 = 召唤 AI 彩蛋              */
/*    7️⃣  AI Greeting Modal  弹窗交互 + 30s 自动浮现                  */
/*    8️⃣  Console Signature  控制台彩蛋（送给好奇的开发者）           */
/* ================================================================== */

(function () {
    'use strict';

    /* ============================================================== */
    /*  全局常量 & 小工具                                              */
    /* ============================================================== */

    const STORAGE_KEYS = {
        theme: 'cesare-theme',
        modalShown: 'cesare-modal-shown',
    };

    const SCROLL_THRESHOLD = 50;       // 滚动多少像素后导航变毛玻璃
    const MODAL_AUTO_DELAY = 30000;    // 30 秒后自动弹出 AI 弹窗
    const LOGO_TRIGGER_COUNT = 3;      // 点 Logo 几次召唤彩蛋
    const LOGO_TRIGGER_WINDOW = 1500;  // 三连击需在 1.5s 内完成

    // 节流函数（用于 scroll 监听 · 避免每帧都跑）
    function throttle(fn, wait = 100) {
        let timer = null;
        let lastRun = 0;
        return function (...args) {
            const now = Date.now();
            const remaining = wait - (now - lastRun);
            if (remaining <= 0) {
                lastRun = now;
                fn.apply(this, args);
            } else if (!timer) {
                timer = setTimeout(() => {
                    lastRun = Date.now();
                    timer = null;
                    fn.apply(this, args);
                }, remaining);
            }
        };
    }

    // 简易 querySelector 封装（更短、更直观）
    const $ = (sel, parent = document) => parent.querySelector(sel);
    const $$ = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

    // 安全地读 localStorage（隐私模式 / 禁用 cookie 时不会崩）
    const storage = {
        get(key) {
            try { return localStorage.getItem(key); } catch (e) { return null; }
        },
        set(key, value) {
            try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
        },
    };


    /* ============================================================== */
    /*  1️⃣  Theme Toggle · 主题切换                                   */
    /* ============================================================== */
    const ThemeToggle = {
        toggleBtn: null,
        iconEl: null,

        init() {
            this.toggleBtn = $('#theme-toggle');
            if (!this.toggleBtn) return;

            this.iconEl = $('.theme-toggle-icon', this.toggleBtn);

            // 初始主题: 优先读 localStorage，其次跟随系统
            const saved = storage.get(STORAGE_KEYS.theme);
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const initial = saved || (prefersDark ? 'dark' : 'light');
            this.apply(initial);

            // 监听系统主题变化（用户没手动选过时才跟随）
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!storage.get(STORAGE_KEYS.theme)) {
                    this.apply(e.matches ? 'dark' : 'light');
                }
            });

            this.toggleBtn.addEventListener('click', () => this.toggle());
        },

        apply(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            // 同步更新移动端浏览器顶部状态栏颜色
            const metaTheme = $('meta[name="theme-color"]');
            if (metaTheme) {
                metaTheme.setAttribute('content', theme === 'dark' ? '#2A2520' : '#FFF8F0');
            }
            // 切换图标
            if (this.iconEl) {
                this.iconEl.textContent = theme === 'dark' ? '🌙' : '🌞';
            }
            this.toggleBtn.setAttribute('aria-label', theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题');
        },

        toggle() {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const next = current === 'light' ? 'dark' : 'light';
            this.apply(next);
            storage.set(STORAGE_KEYS.theme, next);
        },
    };


    /* ============================================================== */
    /*  2️⃣  Header Scroll · 滚动后导航变毛玻璃                       */
    /* ============================================================== */
    const HeaderScroll = {
        header: null,

        init() {
            this.header = $('#site-header');
            if (!this.header) return;

            const handler = throttle(() => this.update(), 80);
            window.addEventListener('scroll', handler, { passive: true });
            this.update();   // 初始检查（可能页面刷新时已经在中间）
        },

        update() {
            const scrolled = window.scrollY > SCROLL_THRESHOLD;
            this.header.classList.toggle('scrolled', scrolled);
        },
    };


    /* ============================================================== */
    /*  3️⃣  Mobile Menu · 移动端抽屉菜单                              */
    /* ============================================================== */
    const MobileMenu = {
        toggleBtn: null,
        drawer: null,
        isOpen: false,

        init() {
            this.toggleBtn = $('#menu-toggle');
            this.drawer = $('#nav-links-mobile');
            if (!this.toggleBtn || !this.drawer) return;

            this.toggleBtn.addEventListener('click', () => this.toggle());

            // 点击抽屉内的链接时自动关闭
            $$('.nav-link-mobile', this.drawer).forEach((link) => {
                link.addEventListener('click', () => this.close());
            });

            // ESC 键关闭
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) this.close();
            });

            // 点击抽屉外部关闭（点击页面其他地方）
            document.addEventListener('click', (e) => {
                if (!this.isOpen) return;
                const clickedInside = this.drawer.contains(e.target) || this.toggleBtn.contains(e.target);
                if (!clickedInside) this.close();
            });

            // 切换到桌面尺寸时自动关闭（避免横屏时菜单留着）
            window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
                if (e.matches && this.isOpen) this.close();
            });
        },

        toggle() { this.isOpen ? this.close() : this.open(); },

        open() {
            this.isOpen = true;
            this.toggleBtn.classList.add('is-open');
            this.drawer.classList.add('is-open');
            this.toggleBtn.setAttribute('aria-expanded', 'true');
            this.drawer.setAttribute('aria-hidden', 'false');
            // 防止背景滚动（提升移动端体验）
            document.body.style.overflow = 'hidden';
        },

        close() {
            this.isOpen = false;
            this.toggleBtn.classList.remove('is-open');
            this.drawer.classList.remove('is-open');
            this.toggleBtn.setAttribute('aria-expanded', 'false');
            this.drawer.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        },
    };


    /* ============================================================== */
    /*  4️⃣  Smooth Nav · 平滑滚动 + 当前锚点高亮                      */
    /*       (smooth 行为已经由 CSS scroll-behavior 提供，             */
    /*        这里主要负责"当前所在板块"的高亮)                        */
    /* ============================================================== */
    const SmoothNav = {
        links: [],
        sections: [],

        init() {
            this.links = $$('.nav-link');
            this.sections = $$('main section[id]');
            if (this.links.length === 0 || this.sections.length === 0) return;

            // 用 IntersectionObserver 监听 section 进入视口
            // rootMargin: 顶部 -40% · 底部 -55% → 让"屏幕中部"成为判断区域
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            this.setActive(entry.target.id);
                        }
                    });
                },
                {
                    rootMargin: '-40% 0px -55% 0px',
                    threshold: 0,
                }
            );

            this.sections.forEach((section) => observer.observe(section));
        },

        setActive(sectionId) {
            this.links.forEach((link) => {
                const href = link.getAttribute('href') || '';
                const match = href === `#${sectionId}`;
                link.classList.toggle('is-active', match);
            });
        },
    };


    /* ============================================================== */
    /*  5️⃣  Fade-in Observer · 滚动渐入                               */
    /*       自动给指定元素添加 .fade-in 类，                          */
    /*       元素进入视口时再添加 .is-visible 触发动画                 */
    /* ============================================================== */
    const FadeIn = {
        // 哪些元素需要渐入 + 是否需要错位延迟
        targets: [
            { selector: '.section-header',                  stagger: false },
            { selector: '.hero-text',                       stagger: false },
            { selector: '.hero-avatar-wrap',                stagger: false },
            { selector: '.about-photo-wrap',                stagger: false },
            { selector: '.about-text',                      stagger: false },
            { selector: '.skills-grid > li',                stagger: true  },
            { selector: '.project-card-feature',            stagger: false },
            { selector: '.projects-grid-small > article',   stagger: true  },
            { selector: '.contact-container',               stagger: false },
        ],

        init() {
            // 如果用户偏好减少动画，就不启用渐入
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return;
            }

            // 浏览器太老不支持 IntersectionObserver 时，全部直接显示
            if (!('IntersectionObserver' in window)) return;

            const observer = new IntersectionObserver(
                (entries, obs) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('is-visible');
                            obs.unobserve(entry.target);   // 一次性触发
                        }
                    });
                },
                { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
            );

            this.targets.forEach(({ selector, stagger }) => {
                $$(selector).forEach((el, i) => {
                    el.classList.add('fade-in');
                    if (stagger) el.classList.add(`delay-${(i % 6) + 1}`);
                    observer.observe(el);
                });
            });
        },
    };


    /* ============================================================== */
    /*  6️⃣  Logo Easter Egg · 三连击召唤 AI 彩蛋                      */
    /* ============================================================== */
    const LogoEasterEgg = {
        logo: null,
        clickCount: 0,
        resetTimer: null,

        init() {
            this.logo = $('.nav-logo');
            if (!this.logo) return;

            this.logo.addEventListener('click', (e) => {
                // 第一次点击不阻止默认行为（让首页锚点正常跳转）
                this.clickCount += 1;

                clearTimeout(this.resetTimer);
                this.resetTimer = setTimeout(() => { this.clickCount = 0; }, LOGO_TRIGGER_WINDOW);

                if (this.clickCount >= LOGO_TRIGGER_COUNT) {
                    e.preventDefault();
                    this.clickCount = 0;
                    AIModal.open({ trigger: 'logo' });
                    // 给 Logo 一个小奖励动画
                    this.logo.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
                    this.logo.style.transform = 'rotate(360deg) scale(1.2)';
                    setTimeout(() => { this.logo.style.transform = ''; }, 700);
                }
            });
        },
    };


    /* ============================================================== */
    /*  7️⃣  AI Greeting Modal · 弹窗交互                              */
    /* ============================================================== */
    const AIModal = {
        modal: null,
        bodyEl: null,
        actionsEl: null,
        autoTimer: null,
        lastFocused: null,         // 关闭后焦点回到打开前的元素
        intentMessages: {
            cooperate: {
                icon: '🤝',
                title: '太好啦～',
                body: '听到"合作"两个字就开心 ☀️<br>请把你的想法 / 项目背景写在邮件里发给我吧～<br>我会在 24 小时内回信，并附上一句小诗作为感谢 ✉️',
            },
            chat: {
                icon: '💬',
                title: '随时欢迎～',
                body: '我也很喜欢"什么都聊一点"的对话 ☕<br>可以给我发邮件，或者来 GitHub 给我开个 Issue 当聊天室～<br>无论是技术问题还是骑行路线，我都很乐意聊聊 🚴',
            },
            wander: {
                icon: '🌿',
                title: '慢慢看吧～',
                body: '路过也是缘分 ✨<br>如果你恰好也是个喜欢"慢节奏"的人，我们已经悄悄成为朋友了 ☀️<br>愿你今天有个好天气～',
            },
        },

        init() {
            this.modal = $('#ai-greeting-modal');
            if (!this.modal) return;

            this.bodyEl = $('.ai-modal-body', this.modal);
            this.actionsEl = $('.ai-modal-actions', this.modal);

            // 关闭按钮 / 背景遮罩 / 任何 [data-modal-close] 元素
            $$('[data-modal-close]', this.modal).forEach((el) => {
                el.addEventListener('click', () => this.close());
            });

            // 意图按钮
            $$('[data-ai-intent]', this.modal).forEach((btn) => {
                btn.addEventListener('click', () => {
                    const intent = btn.getAttribute('data-ai-intent');
                    this.respond(intent);
                });
            });

            // ESC 关闭
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.modal.classList.contains('is-open')) {
                    this.close();
                }
            });

            // 30 秒后自动召唤（每个浏览器会话只触发一次）
            if (!sessionStorage.getItem(STORAGE_KEYS.modalShown)) {
                this.autoTimer = setTimeout(() => {
                    this.open({ trigger: 'auto' });
                }, MODAL_AUTO_DELAY);
            }
        },

        open({ trigger } = {}) {
            // 取消自动定时器（如果手动触发了）
            clearTimeout(this.autoTimer);

            this.lastFocused = document.activeElement;

            this.modal.hidden = false;
            // 强制 reflow 让 transition 生效
            void this.modal.offsetWidth;
            this.modal.classList.add('is-open');
            this.modal.setAttribute('aria-hidden', 'false');

            // 焦点移到关闭按钮（无障碍）
            const closeBtn = $('.ai-modal-close', this.modal);
            if (closeBtn) closeBtn.focus();

            // 标记已弹出过
            try { sessionStorage.setItem(STORAGE_KEYS.modalShown, '1'); } catch (e) { /* ignore */ }

            // 锁定背景滚动
            document.body.style.overflow = 'hidden';

            // (可选) 控制台留个小记录
            if (trigger) console.log(`%c🎈 AI Modal opened via: ${trigger}`, 'color:#FF9F68');
        },

        close() {
            this.modal.classList.remove('is-open');
            this.modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';

            // 等动画结束后再彻底隐藏
            setTimeout(() => {
                this.modal.hidden = true;
                // 焦点回到打开前的元素
                if (this.lastFocused && typeof this.lastFocused.focus === 'function') {
                    this.lastFocused.focus();
                }
                this.resetContent();   // 复原内容，下次打开是初始状态
            }, 350);
        },

        respond(intent) {
            const msg = this.intentMessages[intent];
            if (!msg) return;

            const iconEl = $('.ai-modal-icon', this.modal);
            const titleEl = $('.ai-modal-title', this.modal);

            if (iconEl) iconEl.textContent = msg.icon;
            if (titleEl) titleEl.textContent = msg.title;
            if (this.bodyEl) this.bodyEl.innerHTML = msg.body;

            // 把意图按钮换成"好的"按钮
            if (this.actionsEl) {
                this.actionsEl.innerHTML = '';
                const okBtn = document.createElement('button');
                okBtn.type = 'button';
                okBtn.className = 'btn btn-primary';
                okBtn.textContent = '🌱 好的，谢谢你';
                okBtn.addEventListener('click', () => this.close());
                this.actionsEl.appendChild(okBtn);
                okBtn.focus();
            }
        },

        resetContent() {
            // 复原成初始的 emoji + 标题 + 三个意图按钮
            const iconEl = $('.ai-modal-icon', this.modal);
            const titleEl = $('.ai-modal-title', this.modal);

            if (iconEl) iconEl.textContent = '🤖';
            if (titleEl) titleEl.textContent = 'Hi～我是这个网站的 AI 小助手';
            if (this.bodyEl) {
                this.bodyEl.innerHTML =
                    '我注意到你已经在这里慢慢逛了一会儿啦 ☕<br>' +
                    '想问问：你今天来这里，是想<strong>找人合作</strong>、' +
                    '<strong>聊聊技术</strong>，还是<strong>只是路过看看</strong>？';
            }
            if (this.actionsEl) {
                this.actionsEl.innerHTML = `
                    <button type="button" class="btn btn-secondary" data-ai-intent="cooperate">💼 想找你合作</button>
                    <button type="button" class="btn btn-secondary" data-ai-intent="chat">💬 想聊聊技术</button>
                    <button type="button" class="btn btn-secondary" data-modal-close>🌿 只是路过</button>
                `;
                // 重新绑定事件
                $$('[data-ai-intent]', this.actionsEl).forEach((btn) => {
                    btn.addEventListener('click', () => this.respond(btn.getAttribute('data-ai-intent')));
                });
                $$('[data-modal-close]', this.actionsEl).forEach((btn) => {
                    btn.addEventListener('click', () => this.close());
                });
            }
        },
    };


    /* ============================================================== */
    /*  8️⃣  Console Signature · 控制台彩蛋                            */
    /*      (送给打开 DevTools 的好奇开发者朋友 ☕)                    */
    /* ============================================================== */
    const ConsoleSignature = {
        init() {
            const styles = {
                title: 'font-family:serif; font-size:18px; color:#FF9F68; font-weight:bold; padding:8px 0;',
                body:  'color:#3D2B1F; font-size:13px; line-height:1.7;',
                hint:  'color:#5C8D7B; font-style:italic; font-size:12px;',
            };

            console.log('%c☀️  Hi, fellow developer!', styles.title);
            console.log(
                '%c感谢你打开了控制台 ✨\n' +
                '这个网站由我（Cesare）和 Claude 一起手敲的，\n' +
                '没有用任何框架 / 构建工具，纯 HTML + CSS + JS。\n\n' +
                '如果你也喜欢这种"慢慢做"的感觉，欢迎来打个招呼 ✉️',
                styles.body
            );
            console.log('%c🎁 小提示：试试连续点 3 下左上角的 Logo ～', styles.hint);
        },
    };


    /* ============================================================== */
    /*  🚀  启动 · DOM Ready 后依次初始化所有模块                       */
    /* ============================================================== */
    function init() {
        ThemeToggle.init();
        HeaderScroll.init();
        MobileMenu.init();
        SmoothNav.init();
        FadeIn.init();
        LogoEasterEgg.init();
        AIModal.init();
        ConsoleSignature.init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM 已经 ready（比如 defer 加载场景）
        init();
    }

})();
