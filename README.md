<p align="center"><a href="https://alexandriasrevenge.herokuapp.com/" target="_blank" rel="noopener noreferrer"><img width="300" src="docs/logo.svg" alt="Alexandria's Revenge Logo"></a></p>
<p align="center">
Permanent Storage for Curated Knowledge
</p>
<p align="center">
	https://alexandriasrevenge.herokuapp.com/
</p>

# 🇪🇬 Inspiration
The Great Library of Alexandria in Alexandria, Egypt, was one of the largest and most significant libraries of the ancient world. Over time, however, it dilapidated into nothing but ash and rubble. <br> The Internet is the Library of Alexandria of our era, yet we take for granted just how vulnerable it is. Even with solar flares, natural disasters, and DDoS attacks aside, valuable knowledge is removed from the internet every day. Servers don't run for free, after all. Archive.org does a lot of great work in this space, but it is dangerous for our civilization to be so dependent on a centralized source. Arweave poises an opportunity to decentralize, and thereby secure the greatest library of our time. The purpose of this project is to capture that opportunity.

# 🏊‍♀️  Product Deepdive 
(Section Coming Soon)

# 🚀 Usage & Deployment
## 🖼 Client 
If you only want to build an archive front-end, don't worry about setting up up a server. Simply send queries to https://alexandriasrevenge.herokuapp.com/graphql and you're good to go. <br> The production GraphQL Playground & Documentation (at [/graphql](https://alexandriasrevenge.herokuapp.com/graphql)) makes it a piece of cake! 🎂🍰


## ⚙️ Server 
### Requirements 
* A non-empty Arweave wallet
* Node.js >=v10.1.0
* NPM or Yarn 
* Git

Looking to spin up the backend? That's a piece of cake too. 
<!-- #### Heroku
Smash this Deploy button! 
<br>
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy) -->
### ⬇️ Clone the repository
```bash
git clone https://github.com/mccallofthewild/alexandrias-revenge.git
```
### ⬇️ Install the `node_modules`
```
yarn
```
or 
```
npm i
```
### 💰 Configure Wallet
1. Move an Arweave JWK wallet into the root directory of the project. 
2. Name it `wallet.json`.
3. Create a file named `env.json`. Fill it with:
```
{
	"WALLET_FILE_SECRET": "yourcomplexandcryptographicallysecurepassword"
}
```
`WALLET_FILE_SECRET` is used to encrypt your wallet when you deploy it to the server and push it to your git repository. Ensure that it is long, complex, random and secure. Both `wallet.json` and `env.json` are in `.gitignore`, and thereby will not be made public in git.

From the command line, run:
```
yarn dev
```
This simultaneously starts the development server and updates the encrypted wallet (`wallet.json.enc`) to be your Arweave wallet encrypted with your password.

### 🏨 Host
Publish to Heroku, or your host of choice.
Set the following environment variables accordingly:
<table>
  <tr>
	  <th>Name</th>
	  <th>Value</th>
	</tr>
  <tr>
    <td>NODE_ENV</td>
    <td>production</td>
  </tr>
  <tr>
    <td>WALLET_FILE_SECRET</td>
    <td>yourcomplexandcryptographicallysecurepassword</td>
  </tr>
</table>
