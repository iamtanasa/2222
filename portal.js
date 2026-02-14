document.addEventListener('DOMContentLoaded', function () {
    const valentineSection = document.getElementById('valentine-section');
    const dragobeteSection = document.getElementById('dragobete-section');
    const moodSection = document.getElementById('mood-section');

    const today = new Date();
    const isValentine = today.getDate() === 14 && today.getMonth() === 1; // 1 = februarie
    const isDragobete = today.getDate() === 24 && today.getMonth() === 1;

    if (isValentine) {
        if (valentineSection) valentineSection.style.display = 'block';
        if (dragobeteSection) dragobeteSection.style.display = 'none';
        if (moodSection) moodSection.style.display = 'none';
    } else if (isDragobete) {
        if (valentineSection) valentineSection.style.display = 'none';
        if (dragobeteSection) dragobeteSection.style.display = 'block';
        if (moodSection) moodSection.style.display = 'none';
    } else {
        if (valentineSection) valentineSection.style.display = 'none';
        if (dragobeteSection) dragobeteSection.style.display = 'none';
        if (moodSection) moodSection.style.display = 'block';
    }

    setupValentineSection();
    setupDragobeteSection();
    setupMoodSection();
});

function setupValentineSection() {
    const yesBtn = document.getElementById('valentine-yes');
    const noBtn = document.getElementById('valentine-no');
    const gifWrapper = document.getElementById('valentine-gif-wrapper');
    const loveMessage = document.getElementById('valentine-love-message');

    if (!yesBtn || !noBtn || !gifWrapper) return;

    yesBtn.addEventListener('click', function () {
        // afisam gif-ul, ascundem butoanele si aratam mesajul de dragoste
        gifWrapper.style.display = 'block';
        const buttonsContainer = yesBtn.parentElement;
        if (buttonsContainer) {
            buttonsContainer.style.display = 'none';
        }
        if (loveMessage) {
            loveMessage.style.display = 'block';
        }
    });

    const moveNoButton = () => {
        // mutam butonul "Nu" intr-o directie aleatoare, dar ramanand in acelasi chenar
        const angleDeg = Math.random() * 120 - 60; // intre -60 si 60 de grade
        const angle = angleDeg * Math.PI / 180;
        const distance = 40 + Math.random() * 60; // 40-100px
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        noBtn.style.transform = `translate(${x}px, ${y}px)`;
    };

    ['click', 'touchstart'].forEach(eventName => {
        noBtn.addEventListener(eventName, function (e) {
            e.preventDefault();
            e.stopPropagation();
            moveNoButton();
        });
    });
}

function setupDragobeteSection() {
    const yesBtn = document.getElementById('dragobete-yes');
    const noBtn = document.getElementById('dragobete-no');
    const gifWrapper = document.getElementById('dragobete-gif-wrapper');
    const loveMessage = document.getElementById('dragobete-love-message');

    if (!yesBtn || !noBtn || !gifWrapper) return;

    yesBtn.addEventListener('click', function () {
        gifWrapper.style.display = 'block';
        const buttonsContainer = yesBtn.parentElement;
        if (buttonsContainer) {
            buttonsContainer.style.display = 'none';
        }
        if (loveMessage) {
            loveMessage.style.display = 'block';
        }
    });

    const moveNoButton = () => {
        const angleDeg = Math.random() * 120 - 60;
        const angle = angleDeg * Math.PI / 180;
        const distance = 40 + Math.random() * 60;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        noBtn.style.transform = `translate(${x}px, ${y}px)`;
    };

    ['click', 'touchstart'].forEach(eventName => {
        noBtn.addEventListener(eventName, function (e) {
            e.preventDefault();
            e.stopPropagation();
            moveNoButton();
        });
    });
}

function setupMoodSection() {
    const slider = document.getElementById('mood-slider');
    const valueSpan = document.getElementById('mood-value');
    const messageEl = document.getElementById('support-message');
    const gifsContainer = document.getElementById('support-gifs');

    if (!slider || !valueSpan || !messageEl || !gifsContainer) return;

    const gifEls = Array.from(gifsContainer.querySelectorAll('.support-gif'));

    const messages = [
        'Iubirea mea, nu fi tristă. Trimite-mi un mesaj și se rezolvă tot, promit.',
        'Te iubesc mai mult decât pot spune cuvintele. Ești cea mai frumoasă parte din ziua mea.',
        'Ești atât de deșteaptă și de puternică. Mă faci mereu mândru.',
        'Chiar și în zilele în care nu te simți la 100%, pentru mine ești perfectă.',
        'Îmi place totul la tine: zâmbetul, privirea, modul în care gândești și felul în care iubești.',
        'Dacă ceva te apasă, scrie-mi. Suntem o echipă și trecem împreună peste orice.',
        'Nu uita niciodată cât de specială ești pentru mine. Lumea mea e mai frumoasă cu tine.',
        'Când zâmbești tu, parcă zâmbește tot universul cu tine.',
        'Dacă aș putea, ți-aș pune toate stelele la picioare, doar ca să te văd fericită.',
        'Orice ar fi astăzi, mâine sunt din nou lângă tine, să te țin în brațe.',
        'Ești cel mai frumos gând cu care adorm seara și primul cu care mă trezesc dimineața.'
    ];

    let animating = false;

    const updateLabel = () => {
        valueSpan.textContent = slider.value;
    };

    const showRandomGif = () => {
        if (!gifEls.length) return;
        gifEls.forEach(el => el.classList.remove('active'));
        const index = Math.floor(Math.random() * gifEls.length);
        gifEls[index].classList.add('active');
    };

    const showSupportMessage = () => {
        const index = Math.floor(Math.random() * messages.length);
        messageEl.textContent = messages[index];
        showRandomGif();
    };

    const animateTo100 = () => {
        if (animating) return;
        animating = true;

        let current = parseInt(slider.value, 10) || 0;

        // mica intoarcere in jos, apoi urcare lina spre 100
        if (current < 80) {
            current = Math.max(0, current - 10);
            slider.value = current;
            updateLabel();
        }

        const interval = setInterval(() => {
            current = parseInt(slider.value, 10) || 0;

            if (current >= 100) {
                slider.value = 100;
                updateLabel();
                clearInterval(interval);
                animating = false;
                showSupportMessage();
                return;
            }

            const remaining = 100 - current;
            const step = Math.max(1, Math.round(remaining / 10));
            slider.value = current + step;
            updateLabel();
        }, 80);
    };

    const triggerAnimation = () => {
        updateLabel();
        const value = parseInt(slider.value, 10) || 0;
        if (value === 100) {
            showSupportMessage();
        } else {
            animateTo100();
        }
    };

    slider.addEventListener('input', updateLabel);
    slider.addEventListener('change', triggerAnimation);
    slider.addEventListener('mouseup', triggerAnimation);
    slider.addEventListener('touchend', triggerAnimation);

    updateLabel();
}
