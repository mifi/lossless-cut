# Translation ![](https://hosted.weblate.org/widgets/losslesscut/-/losslesscut/svg-badge.svg)

![](https://hosted.weblate.org/widgets/losslesscut/zh_Hans/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/cs/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/sl/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/it/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/ko/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/de/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/nl/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/fi/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/zh_Hant/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/et/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/fr/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/he/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/hu/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/id/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/lt/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/nb_NO/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/nn/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/fa/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/pl/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/pt/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/pt_BR/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/ro/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/ru/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/sr/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/es/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/sv/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/tr/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/uk/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/vi/losslesscut/svg-badge.svg)
![](https://hosted.weblate.org/widgets/losslesscut/sk/losslesscut/svg-badge.svg)

Thanks to everyone who helped translate the app! 🙌

View a status of [all translations here](https://hosted.weblate.org/projects/losslesscut/losslesscut/). You are welcome to help translate the app in [Weblate](https://hosted.weblate.org/projects/losslesscut/losslesscut/). Weblate will automatically push translations as a Pull Request in this repo, but this PR is not merged immediately by maintainers.

Master language is English and i18n keys are the English strings.

## Testing translations locally

Because the Weblate PR with translation updates is not merged immediately, your changes made in Weblate will not appear automatically in the nightly build. If you want test new weblate translations you made in the app, you need to:
1. Download the translation for your language from Weblate: **Files -> Download translation**
2. Rename the downloaded `.json` file to: `translation.json`
3. Create a [folder structure](https://github.com/mifi/lossless-cut/tree/master/src/main/locales) somewhere on your computer that looks like this:
```
translations/locales/localeCode
```
You can find a list of the available [`localeCode`s here](https://github.com/mifi/lossless-cut/tree/master/src/main/locales). In our example we will use `nb_NO` (Norwegian 🇳🇴) with this path:
```
/Users/mifi/Desktop/translations/locales/nb_NO
```

4. Now move your `translation.json` file into the folder:
```
/Users/mifi/Desktop/translations/locales/nb_NO/translation.json
```

5. Now run LosslessCut from the [command line](cli.md), with the special command line argument `--locales-path`. Use the path to the **folder containing the locales folder**, e.g.:
```bash
./LosslessCut --locales-path /Users/mifi/Desktop/translations
```

Now LosslessCut will use your language local file.


## Weblate merge

Note to LosslessCut maintainers: Weblate [does not allow](https://github.com/WeblateOrg/weblate/issues/7081) any pushes to the weblate LosslessCut github repository (`https://hosted.weblate.org/git/losslesscut/losslesscut/`). This means if their repo becomes out of sync with this repo, the translations will be locked and the `master` branch here needs to be synced with their branch. This should normally not happen unless the weblate PR has been accidentally merged with rebase or squash.
