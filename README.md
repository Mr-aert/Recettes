# Recettes
recettes de cuisines

## Consulter les recettes en local

L’application lit les fichiers Markdown directement dans ce dépôt. Elle ne
nécessite ni compilation ni dépendance à installer.

1. Depuis la racine du dépôt, lancez `python3 server.py`.
2. Ouvrez <http://127.0.0.1:8000> dans votre navigateur.
3. Ajoutez ou modifiez un fichier `.md` : la liste et la recette affichée sont
   actualisées automatiquement sous deux secondes.

Pour arrêter le serveur, utilisez `Ctrl+C` dans le terminal.

## Publier le site sur GitHub Pages

Le workflow `.github/workflows/pages.yml` publie automatiquement le site après
chaque `push` sur `main`. Le site publié est public, même si ce dépôt reste
privé. Les visiteurs n’ont pas besoin de compte GitHub.

Pour activer la publication, ouvrez **Settings → Pages** dans le dépôt et
choisissez **GitHub Actions** comme source de déploiement. Après le premier
`push` sur `main`, l’adresse du site apparaîtra dans cette page.

Chaque déploiement inclut les recettes Markdown du dépôt. Une modification
locale apparaît sur le site après avoir été commitée et poussée vers GitHub,
puis après la fin du workflow Pages. L’utilisation de Pages avec un dépôt privé
peut nécessiter une offre GitHub qui prend en charge Pages pour les dépôts
privés.
